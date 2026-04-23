import json
import logging
import re
from typing import Any, Dict, List

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


def _get_api_key() -> str | None:
    return settings.SONAR_API_KEY or settings.VITE_SONAR_API


def _extract_json_candidates(text: str) -> List[str]:
    """Return possible JSON object substrings from model output."""
    candidates: List[str] = []
    stack = 0
    start_idx: int | None = None

    for idx, ch in enumerate(text):
        if ch == "{":
            if stack == 0:
                start_idx = idx
            stack += 1
        elif ch == "}":
            if stack > 0:
                stack -= 1
                if stack == 0 and start_idx is not None:
                    candidates.append(text[start_idx: idx + 1])
                    start_idx = None

    return candidates


def _parse_sonar_json(content: str) -> Dict[str, Any]:
    """Parse Sonar response content into a JSON object with robust fallbacks."""
    raw = content.strip()
    parse_attempts: List[str] = [raw]

    # Remove fenced code wrappers if present.
    fenced_match = re.search(r"```(?:json)?\s*(.*?)\s*```", raw, re.IGNORECASE | re.DOTALL)
    if fenced_match:
        parse_attempts.append(fenced_match.group(1).strip())

    # Add extracted balanced JSON object candidates.
    parse_attempts.extend(_extract_json_candidates(raw))

    for attempt in parse_attempts:
        if not attempt:
            continue
        try:
            parsed = json.loads(attempt)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue

    raise ValueError("Unable to parse Sonar response into JSON object.")


def _call_sonar(payload: Dict[str, Any], headers: Dict[str, str], timeout: float) -> Dict[str, Any]:
    """Call Sonar endpoint and gracefully retry with a reduced payload on 400s."""
    with httpx.Client(timeout=timeout) as client:
        response = client.post("https://api.perplexity.ai/chat/completions", headers=headers, json=payload)

    if response.status_code == 400 and "response_format" in payload:
        retry_payload = dict(payload)
        retry_payload.pop("response_format", None)
        logger.info("Retrying Sonar call without response_format after 400 response.")
        with httpx.Client(timeout=timeout) as client:
            response = client.post("https://api.perplexity.ai/chat/completions", headers=headers, json=retry_payload)

    response.raise_for_status()
    return response.json()


def analyze_extracted_text(text: str) -> Dict[str, Any]:
    """Analyze extracted OCR text with Perplexity Sonar and return structured JSON.

    Falls back to deterministic local heuristics if API key is unavailable or call fails.
    """
    if not text.strip():
        return {
            "summary": "No extracted text available.",
            "medical_necessity_signals": [],
            "risks": ["EMPTY_OCR_TEXT"],
            "recommendations": ["Upload clearer documents or verify OCR configuration."],
        }

    api_key = _get_api_key()
    if not api_key:
        return {
            "summary": text[:400],
            "medical_necessity_signals": [],
            "risks": ["SONAR_API_KEY_MISSING"],
            "recommendations": ["Set SONAR_API_KEY (or VITE_SONAR_API) in backend .env."],
        }

    system_prompt = (
        "You are a healthcare prior-authorization analysis assistant. "
        "Return strict JSON only with keys: summary, medical_necessity_signals, risks, recommendations."
    )
    user_prompt = (
        "Analyze this OCR-extracted clinical text for prior-authorization review. "
        "Identify key medical necessity signals, potential compliance risks, and concise recommendations.\n\n"
        f"TEXT:\n{text[:12000]}"
    )

    payload = {
        "model": settings.SONAR_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        data = _call_sonar(payload=payload, headers=headers, timeout=30.0)

        content = data["choices"][0]["message"]["content"]
        parsed = _parse_sonar_json(content)

        medical_signals = parsed.get("medical_necessity_signals", [])
        risks = parsed.get("risks", [])
        recommendations = parsed.get("recommendations", [])

        return {
            "summary": parsed.get("summary", ""),
            "medical_necessity_signals": medical_signals if isinstance(medical_signals, list) else [str(medical_signals)],
            "risks": risks if isinstance(risks, list) else [str(risks)],
            "recommendations": recommendations if isinstance(recommendations, list) else [str(recommendations)],
        }
    except Exception as exc:
        logger.warning("Sonar analysis failed, using local fallback: %s", exc)
        lower = text.lower()
        risks = []
        if "denies" in lower or "without" in lower:
            risks.append("NEGATION_DETECTED_REVIEW_REQUIRED")

        return {
            "summary": text[:400],
            "medical_necessity_signals": [],
            "risks": risks or ["SONAR_ANALYSIS_UNAVAILABLE"],
            "recommendations": ["Proceed with rule-based checks; optionally retry Sonar analysis."],
        }


def chat_with_medical_context(user_message: str, pa_context: Dict[str, Any]) -> Dict[str, Any]:
    """Chat with Sonar using a medical advisor/analyst persona and PA context."""
    api_key = _get_api_key()
    used_context_keys: List[str] = sorted(list(pa_context.keys()))

    if not api_key:
        return {
            "answer": "Sonar API key is not configured. Set SONAR_API_KEY (or VITE_SONAR_API) in backend .env.",
            "used_context_keys": used_context_keys,
        }

    system_prompt = (
        "You are an expert medical advisor and prior-authorization analyst. "
        "Use only the provided PA context and user question. "
        "Be concise, clinically careful, and explain recommendations clearly. "
        "If data is missing, explicitly say what is missing and what to request next. "
        "Do not fabricate claims or policy clauses."
    )

    context_blob = json.dumps(pa_context, default=str)[:20000]
    user_prompt = (
        "PA CONTEXT JSON:\n"
        f"{context_blob}\n\n"
        "USER QUESTION:\n"
        f"{user_message}"
    )

    payload = {
        "model": settings.SONAR_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=45.0) as client:
            response = client.post("https://api.perplexity.ai/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        return {
            "answer": content.strip(),
            "used_context_keys": used_context_keys,
        }
    except Exception as exc:
        logger.warning("Sonar chat failed: %s", exc)
        return {
            "answer": "I could not reach Sonar at the moment. Please retry in a moment.",
            "used_context_keys": used_context_keys,
        }

import json
import logging
from typing import Any, Dict, List

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


def _get_api_key() -> str | None:
    return settings.SONAR_API_KEY or settings.VITE_SONAR_API


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
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post("https://api.perplexity.ai/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)

        return {
            "summary": parsed.get("summary", ""),
            "medical_necessity_signals": parsed.get("medical_necessity_signals", []),
            "risks": parsed.get("risks", []),
            "recommendations": parsed.get("recommendations", []),
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

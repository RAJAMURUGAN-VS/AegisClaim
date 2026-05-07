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

    logger.info(f"Sonar API initial response status code: {response.status_code}")
    
    if response.status_code == 400 and "response_format" in payload:
        logger.warning(f"Got 400 status code. Response text: {response.text}")
        retry_payload = dict(payload)
        retry_payload.pop("response_format", None)
        logger.info("Retrying Sonar call without response_format after 400 response.")
        with httpx.Client(timeout=timeout) as client:
            response = client.post("https://api.perplexity.ai/chat/completions", headers=headers, json=retry_payload)
        logger.info(f"Sonar API retry response status code: {response.status_code}")
    
    if response.status_code != 200:
        logger.error(f"Sonar API error - Status: {response.status_code}, Response: {response.text}")
    
    response.raise_for_status()
    return response.json()


def analyze_extracted_text(text: str) -> Dict[str, Any]:
    """Analyze extracted OCR text with Perplexity Sonar and return structured JSON.

    Falls back to deterministic local heuristics if API key is unavailable or call fails.
    """
    logger.info(f"Starting Sonar analysis on text length: {len(text)} chars")
    
    if not text.strip():
        logger.warning("Empty text provided to Sonar analysis")
        return {
            "summary": "No extracted text available.",
            "medical_necessity_signals": [],
            "risks": ["EMPTY_OCR_TEXT"],
            "recommendations": ["Upload clearer documents or verify OCR configuration."],
        }

    api_key = _get_api_key()
    if not api_key:
        logger.error("SONAR_API_KEY or VITE_SONAR_API not set in environment")
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
        logger.info("Calling Perplexity Sonar API...")
        data = _call_sonar(payload=payload, headers=headers, timeout=30.0)
        logger.info("Sonar API call successful")

        content = data["choices"][0]["message"]["content"]
        parsed = _parse_sonar_json(content)
        logger.info(f"Sonar JSON parsed successfully. Keys: {list(parsed.keys())}")

        medical_signals = parsed.get("medical_necessity_signals", [])
        risks = parsed.get("risks", [])
        recommendations = parsed.get("recommendations", [])

        result = {
            "summary": parsed.get("summary", ""),
            "medical_necessity_signals": medical_signals if isinstance(medical_signals, list) else [str(medical_signals)],
            "risks": risks if isinstance(risks, list) else [str(risks)],
            "recommendations": recommendations if isinstance(recommendations, list) else [str(recommendations)],
        }
        logger.info(f"Sonar analysis complete: {len(medical_signals)} signals, {len(risks)} risks, {len(recommendations)} recommendations")
        return result
    except Exception as exc:
        logger.warning(f"Sonar analysis failed, using local fallback: {type(exc).__name__}: {exc}")
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


def extract_medical_codes_from_text(text: str) -> Dict[str, Any]:
    """Extract exact ICD-10 and CPT codes from clinical text using Sonar."""
    api_key = _get_api_key()

    if not text.strip():
        return {
            "icd10Codes": [],
            "cptCodes": [],
            "exactMatchFound": False,
            "message": "No readable text was found in the uploaded documents.",
        }

    if not api_key:
        logger.error("SONAR_API_KEY or VITE_SONAR_API not set in environment")
        return {
            "icd10Codes": [],
            "cptCodes": [],
            "exactMatchFound": False,
            "message": "The code extraction model is not configured. Please enter codes manually.",
        }

    system_prompt = (
        "You are a certified medical coding assistant for prior authorization workflows. "
        "Return strict JSON only with these keys: icd10Codes, cptCodes, exactMatchFound, message. "
        "Only include exact codes that are explicitly supported by the document text. "
        "Do not guess, infer, or map diagnoses to billing codes unless the exact code appears in the text or is unambiguous from the document. "
        "If you cannot find exact codes, return empty arrays, exactMatchFound false, and a message that says the exact code could not be found from the details and document provided."
    )

    user_prompt = (
        "Extract exact ICD-10 and CPT codes from the following clinical text. "
        "If the text names a condition or procedure but does not provide the exact code, do not invent one. "
        "Return JSON only.\n\n"
        f"TEXT:\n{text[:15000]}"
    )

    payload = {
        "model": settings.SONAR_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        logger.info("Calling Sonar for medical code extraction...")
        data = _call_sonar(payload=payload, headers=headers, timeout=30.0)
        content = data["choices"][0]["message"]["content"]
        parsed = _parse_sonar_json(content)

        icd10_codes = parsed.get("icd10Codes", [])
        cpt_codes = parsed.get("cptCodes", [])
        exact_match_found = parsed.get("exactMatchFound", bool(icd10_codes or cpt_codes))
        message = parsed.get("message", "")

        if not isinstance(icd10_codes, list):
            icd10_codes = [str(icd10_codes)] if icd10_codes else []
        if not isinstance(cpt_codes, list):
            cpt_codes = [str(cpt_codes)] if cpt_codes else []

        icd10_codes = sorted({str(code).strip().upper() for code in icd10_codes if str(code).strip()})
        cpt_codes = sorted({str(code).strip().upper() for code in cpt_codes if str(code).strip()})

        if not icd10_codes and not cpt_codes:
            exact_match_found = False
            if not message:
                message = "From the details and document provided, we could not find the exact code. Please review and add it manually."

        return {
            "icd10Codes": icd10_codes,
            "cptCodes": cpt_codes,
            "exactMatchFound": bool(exact_match_found),
            "message": message,
        }
    except Exception as exc:
        logger.warning("Sonar medical code extraction failed, using fallback regex: %s", exc)
        icd10_codes = sorted(set(re.findall(r"\b([A-Z]\d{2}(?:\.\d{0,4})?)\b", text.upper())))
        cpt_codes = sorted(set(re.findall(r"\b(\d{5})\b", text)))
        message = (
            "From the details and document provided, we could not find the exact code. "
            "Please review the extracted text and add codes manually."
            if not icd10_codes and not cpt_codes
            else "The model was unavailable, so these codes were collected from pattern matching. Please review them carefully."
        )
        return {
            "icd10Codes": icd10_codes,
            "cptCodes": cpt_codes,
            "exactMatchFound": bool(icd10_codes or cpt_codes),
            "message": message,
        }


def generate_followup_questions(pa_context: Dict[str, Any], max_questions: int = 6) -> Dict[str, Any]:
    """Generate targeted follow-up questions for a provider to clarify a PA submission.

    Returns a JSON object with key 'questions' containing a list of question dicts.
    Falls back to a small rule-based question set if Sonar is unavailable.
    """
    api_key = _get_api_key()

    # Minimal local fallback
    def _local_fallback():
        questions = [
            {
                "id": "q_failed_conservative",
                "field": "failedConservativeTherapy",
                "type": "select",
                "label": "Has the patient failed conservative therapy?",
                "placeholder": "Select",
                "required": True,
                "options": ["Yes", "No", "Unknown"],
                "rationale": "Determines if less invasive options were tried before escalation",
            },
            {
                "id": "q_duration_symptoms",
                "field": "durationOfSymptoms",
                "type": "text",
                "label": "Duration of symptoms",
                "placeholder": "e.g., 6 months",
                "required": False,
                "minChars": 0,
                "maxChars": 200,
                "rationale": "Helps assess chronicity and guideline alignment",
            },
        ]
        return {"questions": questions, "metadata": {"source": "local_fallback"}}

    if not api_key:
        logger.warning("SONAR API key missing; using local fallback for follow-up questions")
        return _local_fallback()

    # Build prompt
    system_prompt = (
        "You are an assistant that generates targeted follow-up questions for providers submitting prior authorization requests. "
        "Return strict JSON only with keys: questions (array) and metadata. Each question must include id, field, type, label, required, placeholder, rationale, and optionally options/minChars/maxChars. "
        "Do not include any PHI beyond what is provided in the context. Keep questions short and actionable."
    )

    context_blob = json.dumps(pa_context, default=str)[:16000]
    user_prompt = (
        f"PA CONTEXT:\n{context_blob}\n\nGenerate up to {max_questions} targeted questions to clarify medical necessity and coverage for this prior authorization. "
        "Return only JSON as specified."
    )

    payload = {
        "model": settings.SONAR_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.15,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        logger.info("Calling Sonar to generate follow-up questions")
        data = _call_sonar(payload=payload, headers=headers, timeout=25.0)
        content = data["choices"][0]["message"]["content"]
        parsed = _parse_sonar_json(content)

        # Basic sanitization
        questions = parsed.get("questions", [])
        if not isinstance(questions, list) or not questions:
            raise ValueError("Empty questions from Sonar")

        return {"questions": questions, "metadata": parsed.get("metadata", {})}
    except Exception as exc:
        logger.warning("Failed to generate questions via Sonar: %s; using fallback", exc)
        return _local_fallback()

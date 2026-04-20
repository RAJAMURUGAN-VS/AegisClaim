import logging
from pathlib import Path
from typing import Tuple

import httpx

from core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _call_ocr_service(document_path: str) -> dict:
    path = Path(document_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Document not found: {document_path}")

    with path.open("rb") as file_handle:
        files = {"file": (path.name, file_handle, "application/octet-stream")}
        response = httpx.post(
            settings.OCR_SERVICE_URL,
            files=files,
            timeout=settings.OCR_SERVICE_TIMEOUT,
        )

    response.raise_for_status()
    payload = response.json()

    if not payload.get("success", False):
        raise RuntimeError(payload.get("error", "OCR service returned unsuccessful response"))

    return payload


def _extract_text_confidence(payload: dict) -> Tuple[str, float]:
    lines = payload.get("lines", [])
    text = "\n".join([line.get("text", "") for line in lines if line.get("text")])

    confidences = [float(line.get("confidence", 0.0)) for line in lines if line.get("confidence") is not None]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return text, avg_confidence


def extract_text_from_image(image_path: str) -> Tuple[str, float]:
    """Extract text and confidence by calling the OCR microservice."""
    payload = _call_ocr_service(image_path)
    return _extract_text_confidence(payload)


def extract_text_from_pdf(pdf_path: str) -> Tuple[str, float, int]:
    """Extract text and confidence by calling the OCR microservice."""
    payload = _call_ocr_service(pdf_path)
    text, avg_confidence = _extract_text_confidence(payload)
    page_count = int(payload.get("page_count", 1))
    return text, avg_confidence, page_count

import logging
from typing import Tuple

from PIL import Image
import pytesseract
from pdf2image import convert_from_path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _confidence_from_tesseract_data(data: dict) -> float:
    conf_values = []
    for raw in data.get("conf", []):
        try:
            value = float(raw)
            if value >= 0:
                conf_values.append(value)
        except (TypeError, ValueError):
            continue
    if not conf_values:
        return 0.0
    return sum(conf_values) / (len(conf_values) * 100.0)


def extract_text_from_image(image_path: str) -> Tuple[str, float]:
    """Extract text and confidence from an image using Tesseract."""
    image = Image.open(image_path)
    text = pytesseract.image_to_string(image)
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    confidence = _confidence_from_tesseract_data(data)
    return text, confidence


def extract_text_from_pdf(pdf_path: str) -> Tuple[str, float, int]:
    """Extract text from each PDF page by converting pages to images."""
    pages = convert_from_path(pdf_path)
    texts = []
    confidences = []
    for page in pages:
        text = pytesseract.image_to_string(page)
        data = pytesseract.image_to_data(page, output_type=pytesseract.Output.DICT)
        texts.append(text)
        confidences.append(_confidence_from_tesseract_data(data))
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return "\n".join(texts), avg_conf, len(pages)

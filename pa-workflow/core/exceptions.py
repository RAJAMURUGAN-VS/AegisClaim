class OCRException(Exception):
    """Custom exception for OCR processing errors."""
    pass

class TextractTimeoutException(Exception):
    """Custom exception for when AWS Textract job times out."""
    pass

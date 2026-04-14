class OCRException(Exception):
    """Custom exception for OCR processing errors."""
    pass

class TextractTimeoutException(Exception):
    """Custom exception for when AWS Textract job times out."""
    pass

class PolicyRuleNotFoundException(Exception):
    """Raised when no active policy rule is found for a given payer/plan."""
    pass

class ComplianceCheckException(Exception):
    """Custom exception for errors during a compliance check."""
    pass

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

class FraudDetectionException(Exception):
    """Custom exception for errors during fraud detection."""
    pass

class AuthCodeGenerationException(Exception):
    """Raised when an authorization code cannot be uniquely generated."""
    pass

class ScoringException(Exception):
    """Raised for general errors during the scoring and decision process."""
    pass

"""
Direct test of Sonar API to verify it's responding correctly.
Run this to check Sonar API connectivity and response format.
"""
import logging
import sys
from services.sonar_service import analyze_extracted_text
from core.config import settings

# Set up logging to see what's happening
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_sonar_api():
    """Test Sonar API with sample clinical text."""

    # Check if API key is configured
    api_key = settings.SONAR_API_KEY or settings.VITE_SONAR_API
    logger.info(f"API Key configured: {bool(api_key)}")
    if api_key:
        logger.info(f"API Key preview: {api_key[:10]}...")

    # Sample clinical text
    sample_text = """
    Patient: Jane Doe, 42 years old
    Chief Complaint: Persistent knee pain and swelling

    History of Present Illness:
    Patient presents with 6 months of progressive left knee pain.
    Pain is worse with activity and weight bearing.
    Associated with significant morning stiffness lasting 2-3 hours.
    Patient has tried NSAIDs with minimal relief.

    Past Medical History:
    - Type 2 Diabetes (A1C 7.2)
    - Hypertension (controlled on lisinopril)
    - Osteoarthritis in both knees

    Physical Examination:
    Left knee: Effusion present, limited range of motion, positive McMurray's test

    Imaging:
    MRI of left knee: Advanced osteoarthritis with meniscal tear

    Assessment:
    Symptomatic advanced osteoarthritis of left knee with meniscal pathology

    Plan:
    Recommending left total knee arthroplasty (CPT 27447)
    """

    logger.info(f"\n{'='*60}")
    logger.info("Testing Sonar API with sample clinical text")
    logger.info(f"Text length: {len(sample_text)} characters")
    logger.info(f"{'='*60}\n")

    # Call Sonar
    try:
        result = analyze_extracted_text(sample_text)

        logger.info(f"\n{'='*60}")
        logger.info("✅ SONAR RESPONSE RECEIVED")
        logger.info(f"{'='*60}")
        logger.info(f"Response type: {type(result)}")
        logger.info(f"Response keys: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")

        if isinstance(result, dict):
            logger.info(f"\nSummary:\n{result.get('summary', 'N/A')[:200]}...")
            logger.info(f"\nMedical Necessity Signals:\n{result.get('medical_necessity_signals', [])}")
            logger.info(f"\nRisks:\n{result.get('risks', [])}")
            logger.info(f"\nRecommendations:\n{result.get('recommendations', [])}")

            # Check if this is fallback (should not be)
            if "SONAR_API_KEY_MISSING" in result.get('risks', []):
                logger.error("❌ API Key is missing!")
                return False
            if "SONAR_ANALYSIS_UNAVAILABLE" in result.get('risks', []):
                logger.error("❌ Sonar analysis failed - using fallback")
                return False

            logger.info("\n✅ Real Sonar data received!")
            return True
    except Exception as e:
        logger.error(f"❌ Error calling Sonar: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_sonar_api()
    sys.exit(0 if success else 1)

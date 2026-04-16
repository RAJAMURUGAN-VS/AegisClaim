# OCR & Medical Document Processing Setup Guide

## Overview
This document provides step-by-step instructions to set up the OCR and text extraction layer for medical document processing in the AuthGuard AI platform.

## Required Technologies

### 1. **Advanced Open-Source OCR Models**
- **TrOCR** (Transformer-based OCR): General-purpose, good accuracy
- **GOT-OCR 2.0** (General Object Text OCR): Handles complex layouts, tables, mixed content
- **PaddleOCR**: Lightweight, multilingual support
- Requires: `transformers`, `torch`, `torchvision`, `paddleocr`

### 2. **Medical NLP** (Specialized)
- **medspacy**: Clinical NLP (entity recognition, negation detection)
- **scispacy**: Scientific literature NLP models for medical concepts
- **FHIR Validation**: `fhir.resources` for healthcare data standardization

---

## Installation Steps

### Step 1: Create Virtual Environment (if not already done)
```bash
# Navigate to project root
cd d:\Sri Nithilan\Documents\GitHub\AegisClaim\pa-workflow

# Create virtual environment (Windows PowerShell)
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Or on Windows Command Prompt:
# venv\Scripts\activate.bat
```

### Step 2: Upgrade pip
```bash
python -m pip install --upgrade pip setuptools wheel
```

### Step 3: Install OCR & Core Dependencies

**Option A: Recommended (All dependencies)**
```bash
pip install -r requirements.txt
```

**Option B: Staged installation (if you encounter issues)**

**Phase 1 - Core Framework & Database Dependencies:**
```bash
pip install fastapi uvicorn langgraph>=0.2.0 langchain-core>=0.2.0 langchain>=0.2.0 langchain-community>=0.2.0
pip install pydantic>=2.0 pydantic-settings alembic
pip install python-jose[cryptography] passlib[bcrypt] python-multipart
pip install psycopg2-binary pymongo motor sqlalchemy[asyncio] asyncpg redis aioredis
```

**Phase 2 - OCR Core:**
```bash
pip install pdf2image pillow>=10.0.0 pytesseract>=0.3.10
```

**Phase 3 - Deep Learning & Transformers (Large download ~5GB)**
```bash
pip install torch>=2.0.0 torchvision>=0.15.0 transformers>=4.30.0
```

**Phase 4 - Medical NLP & Healthcare Standards:**
```bash
pip install paddleocr scispacy medspacy nltk spacy fhir.resources hl7
```

**Phase 5 - AI Models & Integration:**
```bash
pip install openai>=1.0.0 anthropic>=0.7.0 langchain-openai>=0.1.0 langchain-anthropic>=0.1.0
```

**Phase 6 - ML Utilities & Explainability:**
```bash
pip install scikit-learn pandas numpy scipy shap python-dotenv loguru twilio httpx
```

**Phase 7 - Testing & Dev Tools:**
```bash
pip install pytest pytest-asyncio pytest-cov black flake8 mypy isort
```

### Step 4: Verify Installation

```bash
# Check all imports work correctly
python -c "import torch; import transformers; import fhir; import langchain; print('✓ All imports successful')"

# Test scispacy models download
python -m spacy download en_core_web_sm
python -c "import medspacy; print('✓ medspacy installed')"
```

### Step 5: Download Pre-trained Models (One-time)

```bash
# Download spaCy English model
python -m spacy download en_core_web_md

# Download scispacy biomedical NLP model
pip install https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.2/en_core_sci_md-0.5.2/en_core_sci_md-0.5.2-py3-none-any.whl

# PaddleOCR models auto-download on first use
python -c "from paddleocr import PaddleOCR; ocr = PaddleOCR(use_angle_cls=True, lang='en'); print('✓ PaddleOCR models downloaded')"
```

---

## Environment Variables

Add these to your `.env` file:

```env
# OCR Configuration
OCR_CONFIDENCE_THRESHOLD=0.7
OCR_METHOD=TROCR  # Options: TROCR, PADDLEOCR, TESSERACT, GOT_OCR_2
OCR_MAX_PAGES=100
OCR_TIMEOUT_SECONDS=120

# Medical NLP
MEDICAL_NLP_MODEL=en_core_sci_md
```

---

## Testing OCR Setup

Create a test file `test_ocr_setup.py`:

```python
import asyncio
from pathlib import Path
from pa_workflow.services.ocr_service import DocumentProcessorAgent

async def test_ocr():
    # Test with a sample PDF
    sample_doc = "sample_medical_document.pdf"
    
    agent = DocumentProcessorAgent()
    result = await agent.process_documents(pa_id="test-123", document_paths=[sample_doc])
    
    print(f"OCR Results: {result}")
    print(f"Confidence: {result['overall_confidence']}")
    print(f"Medical Codes Found: {result['medical_codes']}")

if __name__ == "__main__":
    asyncio.run(test_ocr())
```

Run with:
```bash
python test_ocr_setup.py
```

---

## Troubleshooting

### Issue: `torch` installation fails
**Solution**: Install pre-built wheels for your Python version
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
# For CPU-only (faster, smaller):
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

### Issue: `pytesseract` requires Tesseract binary
**Solution**: Download from https://github.com/UB-Mannheim/tesseract/wiki and set path:
```python
import pytesseract
pytesseract.pytesseract.pytesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### Issue: `medspacy` or `scispacy` models not found
**Solution**: Download manually:
```bash
python -c "import spacy; spacy.load('en_core_sci_md')" 
# If fails, install from S3 as shown in Step 5
```

---

## Recommended Architecture

For **Production**:
- Primary: TrOCR or GOT-OCR 2.0 (high quality for complex docs)
- Fallback: PaddleOCR (lightweight, fast)
- Medical NLP: medspacy + scispacy (entity extraction, negation detection)

For **Development/Testing**:
- PaddleOCR or Tesseract (no cloud dependencies)
- medspacy for medical concept extraction

---

## Next Steps

1. Implement `ocr_service.py` with TrOCR and PaddleOCR integration
2. Create medical code extraction pipeline (ICD-10, CPT, RxNorm)
3. Integrate FHIR R4 structuring
4. Build Agent A fully (Document Processor)
5. Set up integration tests with sample medical documents

---

**Last Updated**: April 14, 2026
**Stack**: Python 3.10+, FastAPI, LangGraph, Open-source OCR (TrOCR/PaddleOCR/Tesseract), Transformers

# OCR Service

Standalone OCR microservice.

## Run

```bash
pip install -r requirements.txt
python app.py
```

Service URL: http://localhost:5001

## API

- `POST /ocr`
  - multipart/form-data with field `file`
  - returns OCR text lines, confidence, page count, and extracted fields

# AI-Powered Prior Authorization (PA) Workflow

This project is an implementation of the AI-Powered Prior Authorization system as defined in the `PA_Workflow_Requirements_v1_0.md` document.

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Python 3.11 + FastAPI
- **OCR Microservice**: Python 3.11 + Flask + PaddleOCR
- **AI Orchestration**: LangGraph
- **Databases**: PostgreSQL, MongoDB
- **OCR**: AWS Textract
- **Task Queue**: Redis
- **Containerization**: Docker

## Project Structure

```
pa-workflow/
├── backend/            # FastAPI Backend
│   ├── agents/         # Layer 1 & 2: AI Agent definitions
│   ├── api/            # FastAPI application, routes, schemas
│   ├── core/           # Core components (config, DB connections)
│   ├── models/         # Database models (PostgreSQL, MongoDB)
│   ├── services/       # Business logic (scoring, notifications)
│   ├── tests/          # Unit and integration tests
│   ├── .env.example    # Environment variable template
│   ├── docker-compose.yml  # Docker services definition
│   ├── requirements.txt    # Python dependencies
│   └── README.md       # Backend-specific documentation
├── ocr-service/        # Standalone OCR API service
│   ├── app.py          # OCR API endpoint (/ocr)
│   ├── requirements.txt
│   └── README.md
├── frontend/           # React Frontend
│   ├── src/            # Source code (components, pages, hooks)
│   ├── package.json    # Node dependencies
│   ├── tailwind.config.js  # Tailwind CSS configuration
│   └── README.md       # Frontend-specific documentation
└── README.md           # This file (root documentation)
```

## Quick Start

### Backend Setup

1.  **Navigate to backend folder**
    ```bash
    cd backend
    ```
2.  **Create and fill `.env`** from `.env.example`
3.  **Build and run services** using Docker Compose:
    ```bash
    docker-compose up -d postgres mongo redis
    ```
4.  **Start the API server**:
    ```bash
    uvicorn api.main:app --reload --port 8000
    ```
5.  The API will be available at `http://localhost:8000`

### OCR Service Setup

1.  **Navigate to OCR service folder**
    ```bash
    cd ocr-service
    ```
2.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
3.  **Start OCR service**:
    ```bash
    python app.py
    ```
4.  OCR API will be available at `http://localhost:5001/ocr`

### Frontend Setup

1.  **Navigate to frontend folder**
    ```bash
    cd frontend
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Start the development server**:
    ```bash
    npm run dev
    ```
4.  The frontend will be available at `http://localhost:5173`


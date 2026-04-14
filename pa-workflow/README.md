# AI-Powered Prior Authorization (PA) Workflow

This project is an implementation of the AI-Powered Prior Authorization system as defined in the `PA_Workflow_Requirements_v1_0.md` document.

## Tech Stack
- **Python**: 3.11
- **API**: FastAPI
- **AI Orchestration**: LangGraph
- **Databases**: PostgreSQL, MongoDB
- **OCR**: AWS Textract
- **Task Queue**: Redis
- **Containerization**: Docker

## Project Structure

```
pa-workflow/
├── agents/             # Layer 1 & 2: AI Agent definitions
├── api/                # FastAPI application, routes, schemas
├── core/               # Core components (config, DB connections)
├── models/             # Database models (PostgreSQL, MongoDB)
├── services/           # Business logic (scoring, notifications)
├── tests/              # Unit and integration tests
├── .env.example        # Environment variable template
├── docker-compose.yml  # Docker services definition
├── requirements.txt    # Python dependencies
└── README.md           # This file
```

## Setup

1.  **Clone the repository**
2.  **Create and fill `.env`** from `.env.example`.
3.  **Build and run services** using Docker Compose:
    ```bash
    docker-compose up --build
    ```
4.  The API will be available at `http://localhost:8000`.


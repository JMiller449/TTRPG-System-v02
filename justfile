run-backend:
    python -m uvicorn backend.core.main:app --host 0.0.0.0 --port 6767
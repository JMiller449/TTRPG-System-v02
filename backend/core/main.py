from routes.ws import router as ws_router
from fastapi import FastAPI

def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(ws_router)
    return app

app = create_app()

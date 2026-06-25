from fastapi.routing import APIRoute

from backend.core.main import create_app


def test_no_http_roll20_chat_debug_endpoint_is_registered() -> None:
    app = create_app()
    http_paths = {
        route.path
        for route in app.routes
        if isinstance(route, APIRoute)
    }

    assert not any(
        "chat" in path.lower() or "roll20" in path.lower()
        for path in http_paths
    )

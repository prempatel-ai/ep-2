"""Application factory.

Run with:  uvicorn sahayak.main:create_app --factory
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from sahayak import __version__
from sahayak.api import routes_chat, routes_meta, routes_voice
from sahayak.config import Settings
from sahayak.container import build_container
from sahayak.errors import SahayakError
from sahayak.logging_setup import configure_logging

logger = logging.getLogger(__name__)


class SPAStaticFiles(StaticFiles):
    """Static file server with single-page-app (SPA) fallback for HTML routes."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        try:
            response = await super().get_response(path, scope)
            if response.status_code == 404 and "." not in path:
                return await super().get_response("index.html", scope)
            return response
        except HTTPException as exc:
            if exc.status_code == 404 and "." not in path:
                return await super().get_response("index.html", scope)
            raise


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        container = build_container(settings)
        logger.info("loading models...")
        await container.startup()
        app.state.container = container
        logger.info("ready")
        try:
            yield
        finally:
            await container.shutdown()

    app = FastAPI(title="Sahayak", version=__version__, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(SahayakError)
    async def handle_app_error(_: Request, exc: SahayakError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    app.include_router(routes_meta.router)
    app.include_router(routes_chat.router)
    app.include_router(routes_voice.router)

    if settings.static_dir and settings.static_dir.is_dir():
        app.mount(
            "/",
            SPAStaticFiles(directory=str(settings.static_dir), html=True),
            name="static",
        )
    return app

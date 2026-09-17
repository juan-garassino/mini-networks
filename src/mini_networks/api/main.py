"""FastAPI app factory for mini_networks."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from mini_networks.api.routers.inference import router as inference_router
from mini_networks.api.routers.training import router as training_router
from mini_networks.api.routers.compositions import router as compositions_router
from mini_networks.api.routers.web import router as web_router

# The built Next.js playground (static export). Built from playground/ via
# `npm run build`; FastAPI serves the static `out/` here. Absent until built
# (or in CI before the build step) → skip the mount, the API still runs.
_REPO = Path(__file__).resolve().parents[3]
FRONTEND_DIR = next((d for d in (_REPO / "playground" / "out", _REPO / "frontend") if d.exists()), _REPO / "playground" / "out")


def create_app() -> FastAPI:
    app = FastAPI(
        title="mini_networks",
        description=(
            "Unified ML training, inference, and composition API: "
            "vision, language, RL, and multimodal pipelines"
        ),
        version="0.1.0",
    )

    # The production SPA is served same-origin from "/" below, but the
    # `make playground-dev` workflow runs the UI on :3000 fetching this API on
    # :8000 — cross-origin. Allow the Next dev server's localhost origins so the
    # playground can load /web data in dev.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(training_router, prefix="/train", tags=["training"])
    app.include_router(inference_router, prefix="/infer", tags=["inference"])
    app.include_router(compositions_router, prefix="/compose", tags=["composition"])
    app.include_router(web_router, prefix="/web", tags=["playground"])

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # The Observatory SPA. Mounted LAST so every API route wins over the catch-all.
    if FRONTEND_DIR.exists():
        app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="playground")

    return app


app = create_app()

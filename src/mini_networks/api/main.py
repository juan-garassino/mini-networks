"""FastAPI app factory for mini_networks.

``create_app`` mounts the routers under /train, /infer, /compose and /web, a
/health probe, dev CORS for localhost + private-network origins, and (when
built) the static playground SPA at /. ``app`` is the module-level instance
``python main.py serve`` runs.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from mini_networks.api.routers.inference import router as inference_router
from mini_networks.api.routers.training import router as training_router
from mini_networks.api.routers.compositions import router as compositions_router
from mini_networks.api.routers.web import router as web_router

# localhost, 127.0.0.1 and the RFC 1918 private ranges, any port (dev only).
DEV_ORIGIN_REGEX = (
    r"http://(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}"
    r"|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}):\d+"
)

# The built Next.js playground (static export). Built from playground/ via
# `npm run build`; FastAPI serves the static `out/` here. Absent until built
# (or in CI before the build step) → skip the mount, the API still runs.
_REPO = Path(__file__).resolve().parents[3]
FRONTEND_DIR = next((d for d in (_REPO / "playground" / "out", _REPO / "frontend") if d.exists()), _REPO / "playground" / "out")


def create_app() -> FastAPI:
    """Build the app: routers, CORS, /health and the playground static mount (if built)."""
    app = FastAPI(
        title="mini_networks",
        description=(
            "Unified ML training, inference, and composition API: "
            "vision, language, RL, and multimodal pipelines"
        ),
        version="0.1.0",
    )

    # The production SPA is served same-origin from "/" below, but the
    # `make playground-dev` workflow runs the UI on :3000 (and one port per UI
    # via `make playground-ports`) fetching this API on :8000 — cross-origin.
    # Allow the dev server's localhost origins AND private-network origins, so
    # the owner's phone on the same Wi-Fi/hotspot (http://192.168.x.y:3000)
    # gets data too. Public origins stay refused.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=DEV_ORIGIN_REGEX,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(training_router, prefix="/train", tags=["training"])
    app.include_router(inference_router, prefix="/infer", tags=["inference"])
    app.include_router(compositions_router, prefix="/compose", tags=["composition"])
    app.include_router(web_router, prefix="/web", tags=["playground"])

    @app.get("/health")
    async def health():
        """Liveness probe: always ``{"status": "ok"}``."""
        return {"status": "ok"}

    # The Observatory SPA. Mounted LAST so every API route wins over the catch-all.
    if FRONTEND_DIR.exists():
        app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="playground")

    return app


app = create_app()

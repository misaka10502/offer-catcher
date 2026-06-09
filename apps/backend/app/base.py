import os

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from .api import health_check, v1_router, RequestIDMiddleware
from .core import (
    settings,
    async_engine,
    setup_logging,
    custom_http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)
from .models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await async_engine.dispose()


def create_app() -> FastAPI:
    """
    configure and create the FastAPI application instance.
    """
    setup_logging()

    app = FastAPI(
        title=settings.PROJECT_NAME,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    app.add_middleware(
        SessionMiddleware, secret_key=settings.SESSION_SECRET_KEY, same_site="lax"
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIDMiddleware)

    app.add_exception_handler(HTTPException, custom_http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # 前端静态文件 —— 显式处理路由以确保 .html 后缀自动映射
    if os.path.exists(settings.FRONTEND_PATH):
        # 先挂载 _next 静态资源（JS/CSS/图片等）
        _next_dir = os.path.join(settings.FRONTEND_PATH, "_next")
        if os.path.exists(_next_dir):
            app.mount(
                "/app/_next",
                StaticFiles(directory=_next_dir),
                name="frontend_next",
            )

        @app.api_route("/app/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
        async def serve_frontend(request: Request, full_path: str):
            """Serve frontend HTML pages, resolving paths without .html extension."""
            # 根路径 → index.html
            if not full_path or full_path == "":
                return FileResponse(os.path.join(settings.FRONTEND_PATH, "index.html"))

            # 去掉可能的查询参数
            clean_path = full_path.split("?")[0]

            # 1. 尝试精确匹配
            exact = os.path.join(settings.FRONTEND_PATH, clean_path)
            if os.path.isfile(exact):
                return FileResponse(exact)

            # 2. 尝试添加 .html 后缀
            html_file = os.path.join(settings.FRONTEND_PATH, f"{clean_path}.html")
            if os.path.isfile(html_file):
                return FileResponse(html_file)

            # 3. 尝试作为目录，找 index.html
            index_file = os.path.join(settings.FRONTEND_PATH, clean_path, "index.html")
            if os.path.isfile(index_file):
                return FileResponse(index_file)

            # 4. fallback — 404 页面
            not_found = os.path.join(settings.FRONTEND_PATH, "404.html")
            if os.path.isfile(not_found):
                return FileResponse(not_found, status_code=404)
            raise HTTPException(status_code=404, detail="Not Found")

        # 也处理 /app（无尾部斜杠，无路径参数的情况）
        @app.api_route("/app", methods=["GET", "HEAD"], include_in_schema=False)
        async def serve_frontend_root():
            return FileResponse(os.path.join(settings.FRONTEND_PATH, "index.html"))

    app.include_router(health_check)
    app.include_router(v1_router)

    return app

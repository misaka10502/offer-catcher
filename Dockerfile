FROM python:3.11-slim

WORKDIR /app

# 系统依赖 — 补充 OpenSSL 等运行时库
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc-dev \
    libssl-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY apps/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 验证关键模块可导入
RUN python -c "import fastapi; import uvicorn; import sqlalchemy; import aiosqlite; print('imports OK')"

# 创建运行时目录
RUN mkdir -p Data logs

# 复制后端代码
COPY apps/backend/ .

# 关键环境变量（直接写在 Dockerfile，不依赖 .env 文件路径）
ENV ENV=production
ENV PYTHONDONTWRITEBYTECODE=1
ENV SESSION_SECRET_KEY=offer-catcher-railway-2026
ENV ASYNC_DATABASE_URL=sqlite+aiosqlite:///./Data/app.db
ENV SYNC_DATABASE_URL=sqlite:///./Data/app.db
ENV LLM_PROVIDER=openai
ENV LLM_API_KEY=sk-d6a8683147894595957521d9635c3992
ENV LLM_BASE_URL=https://api.deepseek.com/v1
ENV LL_MODEL=deepseek-chat
ENV EMBEDDING_PROVIDER=openai
ENV EMBEDDING_API_KEY=sk-d6a8683147894595957521d9635c3992
ENV EMBEDDING_BASE_URL=https://api.deepseek.com/v1
ENV EMBEDDING_MODEL=deepseek-chat

# Railway 自动注入 PORT，默认 8000
EXPOSE 8000

CMD ["sh", "-c", "echo 'Starting server on port ${PORT:-8000}...' && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*' --timeout-keep-alive 120"]

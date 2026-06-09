FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖（pdfminer 等需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 创建数据目录和日志目录
RUN mkdir -p Data logs

# 复制全部后端代码
COPY . .

# 环境变量
ENV ENV=production
ENV PYTHONDONTWRITEBYTECODE=1

# Railway 会自动注入 PORT 环境变量
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

# syntax=docker/dockerfile:1.7
# S_Hospital v2 — imagen única: API FastAPI + SPA compilado.

# ---------- 1. Compilar el frontend ----------
FROM node:24-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---------- 2. Runtime Python ----------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SHS_WEB_DIST=/app/web/dist \
    SHS_BACKUP_DIR=/data/backups

# Cliente MariaDB para respaldos (mariadb-dump)
RUN apt-get update \
    && apt-get install -y --no-install-recommends mariadb-client tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/api
COPY api/requirements.txt ./
RUN pip install -r requirements.txt

COPY api/ ./
COPY --from=web /src/web/dist /app/web/dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && useradd --system --uid 10001 --home /app shs \
    && mkdir -p /data/backups && chown -R shs /data /app/api

USER shs
EXPOSE 8000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health').status==200 else 1)"
ENTRYPOINT ["entrypoint.sh"]
CMD ["python", "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]

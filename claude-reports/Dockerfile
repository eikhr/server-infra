FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir "markdown==3.5.2" "pygments==2.17.2"

# Vendored so pages have no external dependency at view time. The UMD bundle is
# self-contained; the ESM build is small but lazily imports the rest of dist/.
ARG MERMAID_VERSION=11.16.1
ARG MERMAID_SHA256=18327bef70d96fb505fe7287d9f6a7362ebf07ff6576ddfaffb1a06f3e1a2954
RUN mkdir -p /app/static \
 && wget -qO /app/static/mermaid.min.js \
      "https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js" \
 && echo "${MERMAID_SHA256}  /app/static/mermaid.min.js" | sha256sum -c -

WORKDIR /app
COPY app.py /app/app.py

EXPOSE 8080
CMD ["python", "/app/app.py"]

ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.20
FROM ${BUILD_FROM}

# Install only Node.js runtime
RUN apk add --no-cache nodejs

WORKDIR /opt/ha-codex

# Copy application and service scripts
COPY app/ /opt/ha-codex/
COPY rootfs/ /

EXPOSE 8099

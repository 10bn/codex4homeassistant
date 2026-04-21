ARG BUILD_FROM
FROM ${BUILD_FROM}

RUN apk add --no-cache nodejs

WORKDIR /opt/ha-codex
COPY app/ /opt/ha-codex/
COPY rootfs/ /

EXPOSE 8099

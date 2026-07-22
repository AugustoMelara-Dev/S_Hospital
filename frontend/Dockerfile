FROM node:22-alpine

RUN apk add --no-cache chromium
RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

WORKDIR /app

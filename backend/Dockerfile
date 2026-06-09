# syntax=docker/dockerfile:1

FROM node:22.3-alpine AS builder

WORKDIR /app

ENV HUSKY=0 \
    NODE_ENV=development

COPY . .

RUN npm install --ignore-scripts && npm run build

FROM node:22.3-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    dumb-init \
    curl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV HUSKY=0 \
    NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json ./
COPY --from=builder /app/package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts \
    && chown -R node:node /app

COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3333/api/v1/health-check || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/src/main.js"]
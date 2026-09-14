# syntax=docker/dockerfile:1

FROM node:22.3-alpine AS deps

WORKDIR /app

ENV HUSKY=0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

FROM deps AS builder

ENV NODE_ENV=development

COPY . .

RUN npm run build && npm run copy-hbs

FROM deps AS prod-deps

ENV NODE_ENV=production

RUN npm prune --omit=dev --ignore-scripts

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

COPY package.json package-lock.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node entrypoint.sh ./entrypoint.sh

RUN chmod +x entrypoint.sh

USER node

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3333/api/v1/health-check || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["sh", "entrypoint.sh"]

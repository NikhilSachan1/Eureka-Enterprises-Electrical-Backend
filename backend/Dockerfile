# syntax=docker/dockerfile:1

# =========================
# BUILD STAGE
# =========================
FROM node:22.3-alpine AS builder

WORKDIR /app

ENV HUSKY=0 \
    NODE_ENV=development

# Copy dependency files first
# This allows Docker to cache npm ci when only source code changes.
COPY package.json package-lock.json ./

RUN npm ci --ignore-scripts

# Copy source only after dependencies are installed
COPY . .

RUN npm run build && npm run copy-hbs


# =========================
# PRODUCTION STAGE
# =========================
FROM node:22.3-alpine AS production

WORKDIR /app

ENV HUSKY=0 \
    NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install only required runtime packages
RUN apk add --no-cache \
    dumb-init \
    curl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Copy dependency files separately so npm layer can be cached
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force \
    && chown -R node:node /app

# Copy only runtime application files
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

USER node

EXPOSE 3333

HEALTHCHECK --interval=30s \
    --timeout=5s \
    --start-period=90s \
    --retries=3 \
    CMD curl -fsS http://127.0.0.1:3333/api/v1/health-check || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["sh", "entrypoint.sh"]

# ==============================================================================
# MACHII MENS MART — MULTI-STAGE PRODUCTION DOCKERFILE
# ==============================================================================

# STAGE 1: Build client bundles & assets
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build production assets
COPY . .
RUN npm run lint
RUN npm run build

# STAGE 2: Lightweight Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled frontend and server files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/vite.config.js ./vite.config.js
COPY --from=builder /app/src/data ./src/data
COPY --from=builder /app/public ./public

# Use non-root node user for security
USER node

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server/productionServer.js"]


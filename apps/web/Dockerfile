# syntax=docker/dockerfile:1

# =============================================================================
# Next.js storefront — production image (standalone output)
#
# This image is for PRE-DEPLOY VALIDATION, not day-to-day dev. It builds the
# app fully; there is no source bind-mount / hot reload. Day-to-day dev stays
# native (`npm run dev`).
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: deps — install node_modules from the lockfile
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

# libc6-compat covers glibc-linked binaries some npm packages ship on Alpine.
RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: builder — produce the standalone production build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Requires `output: 'standalone'` in next.config.ts (produces .next/standalone).
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runner — minimal image, ships only the standalone output
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Run as a non-root user.
RUN addgroup -g 1001 -S nodejs \
    && adduser -S -u 1001 -G nodejs nextjs

# The standalone folder bundles server.js + only the node_modules it traced.
# public/ and .next/static are NOT included by standalone and are copied in so
# server.js can serve them.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

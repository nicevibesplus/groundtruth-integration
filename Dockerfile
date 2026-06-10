ARG NODE_VERSION=22

# ==========================================
# Stage 1: Base image setup
# ==========================================
FROM node:${NODE_VERSION}-alpine AS base

# ==========================================
# Stage 2: Install dependencies
# ==========================================
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ==========================================
# Stage 3: Production runner
# ==========================================
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules from the dependencies stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json

# Copy source code, migrations directory, and entrypoint script
COPY src/ ./src/
COPY drizzle/ ./drizzle/
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

# Security: Create and switch to a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 groundtruth
USER groundtruth


ENTRYPOINT ["./entrypoint.sh"]
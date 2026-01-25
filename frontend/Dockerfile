# Frontend Dockerfile for Next.js application
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Update npm to latest version
RUN npm install -g npm@latest

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with fallback
# npm ci requires exact match, npm install is more forgiving
RUN npm ci --legacy-peer-deps || (echo "npm ci failed, falling back to npm install" && npm install --legacy-peer-deps)

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for build
ENV NEXT_TELEMETRY_DISABLED 1

# Accept build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_API_URL=http://localhost:8001
ARG INTERNAL_API_URL=http://backend:8000
ARG NEXTAUTH_URL=http://localhost:3000

# Set as environment variables for the build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV INTERNAL_API_URL=$INTERNAL_API_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files for standalone output
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Railway sets PORT dynamically, default to 3000 if not set
ENV PORT=${PORT:-3000}
ENV HOSTNAME "0.0.0.0"

EXPOSE $PORT

CMD ["node", "server.js"]

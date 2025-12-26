# ---------- 1) Base image (Debian, not Alpine) ----------
FROM node:20-bookworm-slim AS base
WORKDIR /app

# Optional: speed up / avoid some npm noise
# ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- 2) Dependencies ----------
FROM base AS deps
WORKDIR /app
# If you need build tools for native modules, uncomment:
# RUN apt-get update && apt-get install -y --no-install-recommends \
#   python3 make g++ \
#   && rm -rf /var/lib/apt/lists/*

# Copy only package files first for better caching
# COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# # Install deps (choose based on which lock file exists)
# RUN \
#     if [ -f package-lock.json ]; then npm ci; \
#     elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
#     elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --frozen-lockfile; \
#     else npm install; \
#     fi


COPY package.json package-lock.json* ./

# IMPORTANT:
# - Drop package-lock.json (created on Windows)
# - Use `npm install` (NOT `npm ci`) so optional deps work
# - Install platform-specific native bindings for Linux x64
RUN rm -f package-lock.json \
  && npm install --include=optional \
  && npm install --no-save \
  lightningcss-linux-x64-gnu \
  @tailwindcss/oxide-linux-x64-gnu

# ---------- 3) Build ----------
FROM base AS builder
WORKDIR /app
# Build-time env (non-secret) can go here if needed, e.g.:
# ENV NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Make sure package.json has: "build": "next build"
RUN npm run build

# ---------- 4) Runtime ----------
# FROM base AS runner

FROM node:20-bookworm-slim AS runner
WORKDIR /app

# WORKDIR /app

ENV PORT=8002
ENV NEXT_PUBLIC_BASE_URL=https://safescript.co.uk/api
ENV NEXT_PUBLIC_ONLY_URL=safescript.co.uk/api




# Create non-root user
RUN groupadd -g 1001 nodejs \
  && useradd -u 1001 -g nodejs nextjs

USER nextjs

# Copy required files from builder
# copy both .js / .mjs configs if present
# COPY --from=builder /app/next.config.* ./ 2>/dev/null || true
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=deps    /app/node_modules ./node_modules

EXPOSE ${PORT}

# We'll inject your env vars at runtime, not baked into the image
CMD ["npm", "run", "start"]



# docker build  --no-cache -t 192.168.13.72:5000/userukproject_new_24_dec_2025_latest .      
# docker run -d --name userukproject_new_24_dec_2025_latest -p 80:80 userukproject_new_24_dec_2025_latest_image

# docker tag userukproject_new_24_dec_2025_latest_image 192.168.13.72:5000/userukproject_new_24_dec_2025_latest
# docker push 192.168.13.72:5000/userukproject_new_24_dec_2025_latest
# docker pull 192.168.13.72:5000/userukproject_new_24_dec_2025_latest
# docker run -d --name userukproject_new_24_dec_2025_latest -p 8002:8002 192.168.13.72:5000/userukproject_new_24_dec_2025_latest
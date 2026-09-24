# Practice Toolbox — Railway image (see docs/migration/RAILWAY-MIGRATION-PLAN.md)
FROM node:20-bookworm-slim

# Chromium for Puppeteer management-report PDFs (previously supplied by replit.nix).
# server/pdf-service.ts finds it via `which chromium`.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Use the system Chromium instead of Puppeteer's bundled download.
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /app

# Full install, including devDependencies: the server bundle imports vite and the
# Vite plugins at startup (server/vite.ts -> vite.config.ts).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "run", "start"]

# Payment Management System — Node 20 / Express / Prisma.
# Two stages: compile TypeScript + generate the Prisma client, then run.

FROM node:20-bookworm-slim AS build
WORKDIR /app
# Prisma needs openssl present to pick its query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 3000
# Apply migrations on boot, then start. Demo data is seeded once, by hand.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

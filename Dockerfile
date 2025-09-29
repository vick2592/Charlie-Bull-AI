# Multi-stage Dockerfile for production image
FROM node:20-slim AS base
WORKDIR /app

# 1) Install ALL deps (including dev) for the build stage
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build TypeScript using devDependencies (typescript)
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 3) Install ONLY production deps for the runtime image
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 4) Final runtime image
FROM node:20-slim AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]

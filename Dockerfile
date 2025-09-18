# Multi-stage Dockerfile for production image
FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc* ./
RUN if [ -f yarn.lock ]; then corepack enable && yarn --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    else npm install --omit=dev; fi

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p .

FROM node:20-slim AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]

# syntax=docker/dockerfile:1

# ---------- base ----------
FROM node:24-alpine AS base
WORKDIR /usr/src/app

# ---------- deps: todas as dependências (dev incluso) ----------
FROM base AS deps
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
# O postinstall executa `prisma generate`, que precisa do schema já copiado.
RUN npm ci

# ---------- development: hot reload ----------
FROM deps AS development
ENV NODE_ENV=development
COPY . .
RUN npx prisma generate
EXPOSE 3100
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]

# ---------- build ----------
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# ---------- production: apenas runtime ----------
# Reaproveita o node_modules do build e remove as devDependencies. O Prisma CLI
# fica (é "devOptional": peer opcional do @prisma/client), com o schema engine
# já baixado para Alpine, porque o contêiner aplica as migrations ao subir.
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /usr/src/app/package.json /usr/src/app/package-lock.json /usr/src/app/prisma7.config.ts ./
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force
COPY --from=build /usr/src/app/dist ./dist
USER node
EXPOSE 3100
# GET /health faz SELECT 1 no banco. wget vem no BusyBox do Alpine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3   CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-3100}/health" || exit 1
# Aplica as migrations pendentes antes de iniciar; se falhar, o contêiner não sobe.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]

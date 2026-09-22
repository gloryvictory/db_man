# db_man — PostgreSQL Browser
# Многоступенчатая сборка: компилируем server (tsc) и client (vite), затем тонкий runtime.
# Сервер сам раздаёт и API, и собранный SPA (client/dist).

# ---------- этап сборки ----------
FROM node:22-alpine AS build

WORKDIR /app

# сначала только манифесты, чтобы слой установки зависимостей кешировался
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

# исходники и сборка (server: tsc -> server/dist; client: vite -> client/dist)
COPY server server
COPY client client
RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runtime

WORKDIR /app

# HOST=0.0.0.0 обязателен в контейнере (иначе Express слушает только 127.0.0.1 внутри)
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001

# только production-зависимости (по package-lock.json)
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# собранные артефакты
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# конфиг (HOST/PORT/SQLITE_PATH переопределяются переменными окружения)
COPY config.json ./

# данные SQLite (пользователи, подключения, журнал запросов, аудит)
VOLUME /app/data

EXPOSE 3001

CMD ["node", "server/dist/index.js"]

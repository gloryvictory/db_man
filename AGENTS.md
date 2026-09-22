# AGENTS.md — правила работы с репозиторием db_man

Инструкции для AI-агентов (Claude Code, Codex, Cursor и др.). Прочитай целиком
перед любыми правками. Подробная справка — в `docs/project_prompt.md` и `README.md`.

## Что это

`db_man` — веб-браузер PostgreSQL (упрощённый pgAdmin/DBeaver). Монрепозиторий
npm workspaces: `server` (Express + `pg` + `node:sqlite` + `xlsx`) и `client`
(React 18 + Vite + Tailwind + Zustand + TanStack Table + lucide-react). Сервер
раздаёт и API, и собранный SPA (`client/dist`) — единый origin. Интерфейс на русском.

## Команды

```bash
npm install          # установка (workspaces)
npm run dev          # сервер :3001 + клиент :5173 (concurrently)
npm run build        # server: tsc → server/dist; client: tsc && vite build → client/dist
npm run typecheck    # tsc --noEmit обеих частей
npm run dev -w server   # только сервер (tsx watch)
npm run build -w client # только клиент
```

Сервер (prod): `cd server && node dist/index.js` (порт 3001).
Healthcheck: `curl http://127.0.0.1:3001/api/health`.
Docker: `docker compose up -d --build`.

После любых правок `npm run build` должен проходить **чисто** (без ошибок tsc/vite).

## Критичные правила (не нарушать)

1. **Пароли.** Пароли БД хранятся только в памяти сервера (`server/src/pools.ts`),
   никогда не пишутся в SQLite и не возвращаются через API — только флаги
   `hasPassword` / `hasSavedPassword`. Опциональное сохранение пароля подключения —
   таблица `connection_secrets` (НЕ `connections`). Пароли пользователей приложения —
   scrypt+соль, никогда в открытом виде. В журнал пишется DSN с замаскированным паролем.

2. **SQL-инъекции.** Любое имя схемы/таблицы/колонки из URL или тела запроса обязано
   проходить `assertIdent` (`server/src/ident.ts`, `IDENT_RE`) и экранироваться `quote()`.
   Прямая интерполяция идентификаторов в SQL запрещена. Единственное исключение —
   SQL-консоль (вкладка «SQL»), которая намеренно выполняет произвольный SQL как есть.

3. **UI.** Тёмный, плотный, моноширинный текст для имён и значений. Эталон макета —
   `C:\Users\Glory\pg-browser\prototype\index.html` (НЕ трогать; не перезаписывать).
   Светлая тема — CSS-переменные + атрибут `data-theme`, выбор в `localStorage`.
   Все надписи, кнопки, сообщения — на русском.

4. **Инкрементальность.** Строго одна фича за раз; после каждого изменения —
   проверка на реальной БД и `git commit` + `git push origin main`. Не накапливать
   непроверенные правки.

## Архитектура (карта файлов)

- `server/src/index.ts` — Express: маршруты, раздача `client/dist`, обработчик ошибок (`friendlyPgError`).
- `server/src/config.ts` — читает `config.json` (корень) + env `HOST` / `PORT` / `SQLITE_PATH`.
- `server/src/ident.ts` — `assertIdent`, `quote`.
- `server/src/sqlite.ts` — `node:sqlite`: users, sessions, connections, connection_secrets,
  query_log, audit_log; `initDb` создаёт админа `admin`/`admin`.
- `server/src/pools.ts` — пулы pg; пароли только в памяти.
- `server/src/db.ts` — каталог, данные, анализ, DDL, качество данных, tablespaces,
  sessions/locks, slow queries, `runQuery`, `renameDatabase`, `getColumnsList`.
- `server/src/auth.ts` — `requireAuth`/`requireAdmin`, `AsyncLocalStorage`.
- `server/src/pgerror.ts` — маппинг ошибок по `e.code` (сервер `lc_messages=WIN1251`).
- `server/src/routes/` — connections, catalog, table, export, maintenance, database,
  schema, logs, audit, auth, users.
- `client/src/` — `store.ts` (zustand), `api.ts`, `types.ts`, `lib/export.ts` (Excel/CSV
  на клиенте), `lib/format.ts`, `components/ui.tsx` (свои UI-примитивы, сторонней библиотеки нет).

## Хранение (SQLite, путь из config.json → `./data/dbman.db`)

- `connections` — подключения (host/port/database/username/user_id); пароль отдельно.
- `query_log` — журнал: host, port, database, username, dsn, query, duration_ms, rows, error, user_id.
- `audit_log` — username, action, target, detail, status, error, user_id.
- `connection_secrets` — опционально сохранённый пароль подключения.

## Подводные камни

- Tailwind `preflight` должен оставаться включённым (иначе ломаются `border-style` и `box-sizing`).
- VACUUM/ANALYZE/REINDEX — только в autocommit, вне транзакции.
- Клиентский экспорт (структура/индексы/анализ) — SheetJS `xlsx` на клиенте
  (`lib/export.ts`); данные таблицы и журнал — серверный `xlsx`.
- Node ≥ 22.13 обязателен (`node:sqlite`; в Node 22 есть ExperimentalWarning — это норма).
- Windows Git Bash: фоновый запуск сервера через `powershell.exe Start-Process` /
  остановка `powershell.exe Stop-Process`; native-инструментам пути в виде `C:/...`.

## Проверка

- Реальная БД: локальный PostgreSQL `127.0.0.1:5432`, пользователь `postgres`; базы
  `neo_klass` (PostGIS), `postgres`, `gdx2`, `gdx2_old`, `neo_nsi`, `test1` и др.
- Визуально — локально установленный Chrome через CDP (headless, `--remote-debugging-port`).
- API — `curl`/скрипты через `/api`; сессия — HttpOnly-cookie (логин `admin`/`admin`).

## Git

- Репозиторий: `https://github.com/gloryvictory/db_man`, ветка `main`.
- Коммиты — на русском, `feat:`/`fix:`/`docs:` и т.п. После завершённой фичи —
  commit + push.

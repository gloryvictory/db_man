# db_man — браузер PostgreSQL

> Краткая справка по проекту для другого агента: что это, как устроено, что критично не сломать.

## О проекте (одним абзацем)

`db_man` — веб-приложение для просмотра и обслуживания PostgreSQL. Слева — дерево
`подключение → база данных → схема → таблицы` (ленивая загрузка при раскрытии). При
выборе таблицы справа открываются вкладки «Данные», «Структура», «SQL», «Сервис».
Клик по базе или схеме открывает панели «Информация», «Сервис», «Анализ». По сути —
упрощённый pgAdmin/DBeaver: данные, структура, статистика и обслуживание
(VACUUM/ANALYZE/REINDEX) без SQL-консоли.

## На что делать акцент (критично, не упустить)

1. **Безопасность паролей.** Пароли БД хранятся только в памяти сервера
   (`server/src/pools.ts`). Никогда не пишутся в SQLite и не возвращаются через API:
   во всех ответах — только флаг `hasPassword`, пароль маскируется как `****`.
   В журнал запросов пишется DSN с замаскированным паролем (`postgresql://***@host:port/db`).
2. **Защита от SQL-инъекций.** Все имена схем/таблиц/колонок из URL или тела запроса
   обязаны проходить валидацию (`ident.ts`: `assertIdent`, `IDENT_RE = /^[A-Za-z_][A-Za-z0-9_$]*$/`)
   и экранироваться через `quote_ident` перед подстановкой в SQL. Прямая интерполяция
   идентификаторов запрещена.
3. **Точное соответствие макету.** UI тёмный, плотный, моноширинный текст для имён и
   значений, без hero-карточек — «поверхность типа Operate/Inspect». Эталон —
   `C:\Users\Glory\pg-browser\prototype\index.html` (его НЕ трогать). Пользователь строго
   следит за совпадением с макетом.
4. **Инкрементальная разработка.** Строго по одной фиче за раз; после каждого изменения —
   проверка на реальной БД и коммит + push в GitHub. Не накапливать правки без проверки.
5. **Русский интерфейс.** Все надписи, кнопки, сообщения — на русском.

## Архитектура

Монрепозиторий с npm workspaces (`server` + `client`), TypeScript везде.

- **Сервер** (`server/`): Express + `pg` (драйвер PostgreSQL). `node:sqlite` — хранилище
  подключений и журнал запросов. `xlsx` — генерация Excel (экспорт данных и журнала).
  Собирается `tsc` в `dist/`, запуск `node dist/index.js`. Сервер также раздаёт собранный
  SPA (единый origin — удобно для nginx).
- **Клиент** (`client/`): React 18 + Vite + Tailwind CSS. Состояние — Zustand (`store.ts`),
  сетка — TanStack Table, иконки — lucide-react, тосты — react-hot-toast, график обзора —
  recharts. UI-примитивы — собственные (`components/ui.tsx`), сторонней UI-библиотеки нет.

## Стек (точные версии)

**Сервер** (dependencies): `express` ^4.18.2, `pg` ^8.11.3, `cors` ^2.8.5,
`dotenv` ^16.3.1, `xlsx` ^0.18.5. `node:sqlite` — встроенный, требует Node ≥ 22.5.
Dev: `tsx` ^4.6.2, `typescript` ^5.3.2, `@types/*`.

**Клиент** (dependencies): `react` 18.2.0, `react-dom` 18.2.0, `react-router-dom` 6.20.0,
`@tanstack/react-table` ^8.21.3, `zustand` 4.4.0, `lucide-react` 0.263.1,
`react-hot-toast` 2.6.0, `recharts` ^2.10.3, `clsx` 2.0.0, `tailwind-merge` 1.14.0,
`xlsx` ^0.18.5. Dev: `vite` 5.0.8, `tailwindcss` 3.3.5, `@vitejs/plugin-react` 4.2.1,
`typescript` 5.3.2.

## Структура проекта

```
db_man/
├── config.json            # единая конфигурация сервера и клиента
├── nginx.conf             # пример прокси на server.host:server.port
├── package.json           # workspaces: server + client, скрипты dev/build/typecheck
├── README.md              # описание, стек, конфиг, полный список API
├── docs/screenshot.png    # скриншот
├── server/
│   ├── .env.example       # HOST / PORT / SQLITE_PATH (переопределяют config.json)
│   └── src/
│       ├── index.ts       # Express: routes, статика SPA, app.listen(config.port, config.host)
│       ├── config.ts      # читает ../config.json + env-override
│       ├── ident.ts       # assertIdent, quote_ident, IDENT_RE
│       ├── sqlite.ts      # node:sqlite: connections + query_log (авто-миграция колонок)
│       ├── pools.ts       # пулы pg; пароли только в памяти
│       ├── db.ts          # каталог, данные, статистика, обслуживание, info/analysis
│       ├── types/xlsx.d.ts
│       └── routes/        # connections, catalog, table, export, maintenance, database, schema, logs
└── client/
    └── src/
        ├── main.tsx, App.tsx
        ├── store.ts       # zustand: activeConnId, selected (таблица), selectedDb, selectedSchema,
        │                  # view/dbView/schemaView, пагинация
        ├── api.ts         # HTTP-клиент (fetch)
        ├── types.ts       # типы API
        ├── xlsx.d.ts
        ├── lib/           # format.ts (formatBytes/formatDateRel), export.ts (Excel/CSV), cn.ts
        ├── pages/         # Browser.tsx (диспетчер: таблица/БД/схема), Overview.tsx
        └── components/    # ui.tsx (Button/Select/Modal/Input/Field/Tabs/Loader/Badge/Info),
                           # Sidebar, Topbar, DataView, StructureView, SqlView, ServiceView,
                           # SchemaView, DatabaseView, AnalysisTable,
                           # ConnectionModal, PasswordModal, LogsModal
```

## Возможности

- **Дерево БД** — подключения → базы → схемы → таблицы, ленивая загрузка, у таблиц оценка строк.
  - **База**: «Информация» (размер, счётчики, кодировка), «Сервис» (VACUUM/ANALYZE/REINDEX
    DATABASE + статистика `pg_stat_database`), «Анализ» (таблица всех таблиц БД, первая
    колонка — имя схемы).
  - **Схема**: «Информация» (размеры, счётчики), «Анализ» (таблица по таблицам: колонки/строки/
    размеры/VACUUM/ANALYZE).
- **Данные** (таблица) — сетка TanStack Table: серверная сортировка, фильтр по значению,
  пагинация LIMIT/offset, экспорт Excel/CSV.
- **Структура** — колонки: тип, NOT NULL, DEFAULT, PK/FK.
- **SQL** — сгенерированный `CREATE TABLE` по `pg_catalog`.
- **Сервис** (таблица) — размер (всего/таблица/индексы/TOAST), табличное пространство,
  `relfilenode`; индексы с кнопками «Перестроить» (REINDEX INDEX) и «Перестроить все»
  (REINDEX TABLE); последний VACUUM/ANALYZE (относительные даты «сегодня/вчера/N дней назад»)
  + кнопки запуска; раздел «Пространственный индекс» для `geometry`/`geography`
  (GiST — перестроить или создать).
- **Журнал** — все запросы (host, port, database, username, dsn) в SQLite, экспорт
  Excel/CSV (страница или весь).
- **Обзор** — диаграмма крупнейших таблиц (recharts).
- **Экспорт в Excel** — данные таблицы и журнал — на сервере (`xlsx`); таблицы структуры,
  индексов и анализа — на клиенте (`lib/export.ts`, SheetJS `xlsx`).

## API (кратко)

Полный список — в `README.md`. Основные группы:
- `/api/connections` — список/создание подключений, `/connect` (пароль в памяти).
- `/api/connections/:id/databases` → `/schemas` → `/tables` → `/columns`, `/rows`,
  `/export`, `/service`, `/sql`, `/stats`.
- `/api/connections/:id/databases/:db/info`, `/service`, `/analysis`,
  `/service/{vacuum,analyze,reindex}`.
- `/api/connections/:id/databases/:db/schemas/:s/info`, `/analysis`.
- `/api/connections/:id/databases/:db/schemas/:s/tables/:t/service/{reindex,reindex-table,vacuum,analyze,spatial-index}`.
- `/api/logs`, `/api/logs/export`.

## Конфигурация

`config.json` (корень):
```json
{
  "server": { "host": "127.0.0.1", "port": 3001, "sqlitePath": "./data/dbman.db" },
  "client": { "host": "127.0.0.1", "port": 5173, "apiProxy": "http://127.0.0.1:3001" }
}
```

- `server.host` / `server.port` — где слушает Express; `sqlitePath` — файл SQLite.
- `client.host` / `client.port` — dev-сервер Vite; `apiProxy` — прокси `/api` в dev.
- Env `HOST` / `PORT` / `SQLITE_PATH` (шаблон в `server/.env.example`) переопределяют config.json.
- `nginx.conf` — проксирует весь трафик на `server.host:server.port`, таймауты 600 с
  (долгие VACUUM/REINDEX).

## Хранение (SQLite, `server/data/dbman.db`)

- `connections` — сохранённые подключения: host, port, database, username, `hasPassword`
  (сам пароль НЕ хранится).
- `query_log` — журнал: host, port, database, username, dsn (маскированный пароль), sql,
  duration, created_at. Авто-миграция добавляет новые колонки.

## Запуск и проверка

```bash
npm install
npm run dev          # сервер :3001 + клиент :5173 (concurrently)
npm run build        # tsc сервера + (tsc && vite build) клиента
npm run typecheck    # tsc --noEmit обеих частей
```

- Dev: открыть http://localhost:5173.
- Сервер сам раздаёт собранный SPA — на проде/nginx достаточно проксировать на `server.port`.
- Проверка на живой БД: локальный PostgreSQL `localhost:5432` (пользователь `postgres`),
  базы `G24-2`, `gdx2`, `gdx2_old`, `neo_klass`, `neo_nsi`, `postgis_36_sample`, `postgres`, `test1`.

## Решения и подводные камни (важно знать)

- **Mantine удалён.** Первая версия на `@mantine/core` не совпадала с макетом; заменена
  собственными примитивами в `components/ui.tsx` + Tailwind. Если UI «поплыл» — смотреть туда.
- **Tailwind `preflight` включён.** Однажды был отключён ради Mantine, из-за чего ломались
  `border-style: solid` и `box-sizing: border-box` (невидимые линии таблицы). Не отключать.
- **Клиентский экспорт** (структура/индексы/анализ) — через SheetJS `xlsx` на клиенте
  (`lib/export.ts`, `exportToExcel`), т.к. данные уже в состоянии. Данные таблицы и журнал —
  серверным `xlsx`.
- **VACUUM/ANALYZE/REINDEX** выполняются через пул в autocommit (вне транзакции) — эти
  операции нельзя оборачивать в транзакцию.
- **Windows Git Bash** — фоновый запуск сервера через `powershell.exe Start-Process`
  (не `node dist/index.js &` — процесс убивается); native-инструментам пути передавать
  в виде `C:/...`.
- **`tsc -b` у клиента** генерировал `vite.config.js`/`.d.ts` рядом с исходником; поэтому
  build клиента — `tsc && vite build`.
- Node ≥ 22.5 обязателен (`node:sqlite`).

## Git

- Репозиторий: `https://github.com/gloryvictory/db_man`, ветка `main`.
- Правило: после каждой завершённой фичи — `git commit` + `git push origin main`.

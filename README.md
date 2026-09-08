# db_man — PostgreSQL Browser

Веб-приложение для просмотра и обслуживания PostgreSQL: слева дерево
`подключение → база → схема → таблицы`, справа — данные выбранной таблицы
в табличном виде, а также структура, SQL и средства обслуживания.

![db_man — PostgreSQL Browser](docs/screenshot.png)

## Возможности

- **Дерево БД** — иерархия подключений, баз, схем и таблиц с ленивой загрузкой
  (данные подгружаются при раскрытии) и оценкой числа строк у каждой таблицы.
  Клик по базе данных открывает панели «Информация» и «Сервис», клик по схеме —
  «Информация» и «Анализ» (таблица с колонками/строками/размерами по каждой таблице).
- **Данные** — табличная сетка на TanStack Table: серверная сортировка, фильтр
  по значению, пагинация (LIMIT/offset), экспорт в Excel и CSV.
- **Структура** — колонки с типами, NOT NULL, DEFAULT, первичными и внешними ключами.
- **SQL** — сгенерированный `CREATE TABLE` по метаданным `pg_catalog`.
- **Сервис** — размер таблицы (всего/таблица/индексы/TOAST), табличное
  пространство, `relfilenode`, оценка строк; список индексов с кнопкой
  «Перестроить» (`REINDEX INDEX`) и «Перестроить все» (`REINDEX TABLE`);
  последний VACUUM/ANALYZE с относительными датами и кнопками запуска;
  раздел «Пространственный индекс» для таблиц с колонкой `geometry`/`geography`
  — перестроение существующего GiST-индекса или создание нового.
- **Журнал** — все выполненные запросы (с сервером, портом, БД, пользователем
  и DSN) пишутся в SQLite и доступны с экспортом в Excel/CSV (страница или весь).
- **Обзор** — горизонтальная диаграмма крупнейших таблиц (recharts).

## Безопасность

- **Пароли** хранятся только в памяти сервера: никогда не пишутся в SQLite
  и не возвращаются через API (в ответах — только признак `hasPassword`).
- Имена схем/таблиц/колонок из URL валидируются (`assertIdent`) и экранируются
  двойными кавычками — защита от SQL-инъекций.
- Пул соединений `pg` живёт на сервере, пароль БД не уходит в браузер.
- `VACUUM`/`ANALYZE`/`REINDEX` выполняются вне транзакций (пул в autocommit).

## Стек

**Сервер** (`server/`, Express + TypeScript): `express`, `pg`, `node:sqlite`
(конфигурации + журнал), `xlsx`, `cors`, `dotenv`, `tsx`.

**Клиент** (`client/`, React + Vite): `@tanstack/react-table`, `zustand`,
`lucide-react`, `react-hot-toast`, `recharts`, `react-router-dom`, `tailwindcss`,
собственные компоненты (`components/ui.tsx`).

## Запуск

Требуется Node.js ≥ 22.5 (для `node:sqlite`).

```bash
npm install
npm run dev        # сервер :3001 + клиент :5173
```

Откройте http://localhost:5173, добавьте подключение
(host / port / database / username / password).

## Структура

```
db_man/
├── package.json          # workspaces: server + client
├── server/               # Express API
│   └── src/
│       ├── index.ts      # точка входа
│       ├── config.ts
│       ├── sqlite.ts     # node:sqlite (конфигурации + журнал)
│       ├── pools.ts      # пулы pg, пароли в памяти
│       ├── ident.ts      # безопасные идентификаторы
│       ├── db.ts         # каталог, данные, сервис/обслуживание (pg_catalog)
│       └── routes/       # connections, catalog, table, export, maintenance, logs
└── client/               # React SPA
    └── src/
        ├── store.ts      # zustand
        ├── api.ts
        ├── components/   # Topbar, Sidebar, DataView, StructureView, SqlView,
        │                 # ServiceView, ui (примитивы), модалки
        └── pages/        # Browser, Overview
```

## API

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/connections` | список подключений |
| POST | `/api/connections` | создать (+тест соединения) |
| POST | `/api/connections/:id/connect` | подключиться (пароль необязателен) |
| GET | `/api/connections/:id/databases` | список баз |
| GET | `/api/connections/:id/databases/:db/schemas` | схемы |
| GET | `/api/connections/:id/databases/:db/schemas/:s/tables` | таблицы (+оценка строк) |
| GET | `…/tables/:t/columns` | колонки |
| GET | `…/tables/:t/rows?limit&offset&sort&dir&filter` | строки (+total) |
| GET | `…/tables/:t/export?format=xlsx\|csv` | экспорт |
| GET | `/api/connections/:id/databases/:db/stats` | размеры таблиц |
| GET | `…/tables/:t/service` | сервис: размер/расположение, индексы, VACUUM/ANALYZE, пространственные индексы |
| POST | `…/tables/:t/service/reindex` | перестроить индекс (`{ index }`) |
| POST | `…/tables/:t/service/reindex-table` | перестроить все индексы (`REINDEX TABLE`) |
| POST | `…/tables/:t/service/vacuum` | `VACUUM` таблицы |
| POST | `…/tables/:t/service/analyze` | `ANALYZE` таблицы |
| POST | `…/tables/:t/service/spatial-index` | создать пространственный (GiST) индекс (`{ column }`) |
| GET | `/api/connections/:id/databases/:db/info` | информация о БД (размер, счётчики, кодировка) |
| GET | `/api/connections/:id/databases/:db/service` | статистика БД (`pg_stat_database`) |
| POST | `/api/connections/:id/databases/:db/service/vacuum` | `VACUUM` всей БД |
| POST | `/api/connections/:id/databases/:db/service/analyze` | `ANALYZE` всей БД |
| POST | `/api/connections/:id/databases/:db/service/reindex` | `REINDEX DATABASE` (все индексы БД) |
| GET | `/api/connections/:id/databases/:db/schemas/:s/info` | информация о схеме (размер, счётчики) |
| GET | `/api/connections/:id/databases/:db/schemas/:s/analysis` | анализ таблиц схемы (колонки/строки/размеры/VACUUM/ANALYZE) |
| GET | `/api/logs` | журнал запросов (пагинация: `limit`/`offset`) |
| GET | `/api/logs/export?format=xlsx\|csv&limit=&offset=` | выгрузка журнала (страница или весь) |

# db_man — PostgreSQL Browser

Веб-приложение для просмотра PostgreSQL: слева дерево `подключение → база → схема → таблицы`, справа — данные выбранной таблицы в табличном виде.

## Стек

**Сервер** (`server/`, Express + TypeScript):
- `express` — HTTP
- `pg` — драйвер PostgreSQL (пул соединений на сервере)
- `node:sqlite` — хранение конфигураций подключений и журнала запросов
- `xlsx` — экспорт в Excel
- `cors`, `dotenv`, `tsx`, `typescript`

**Клиент** (`client/`, React + Vite):
- `@mantine/core`, `@mantine/hooks` — UI-компоненты
- `@tanstack/react-table` — табличная сетка
- `zustand` — состояние
- `lucide-react` — иконки
- `react-hot-toast` — тосты
- `recharts` — графики (обзор размеров таблиц)
- `react-router-dom` — роутинг
- `tailwindcss` — утилиты

## Запуск

Требуется Node.js ≥ 22.5 (для `node:sqlite`).

```bash
# из корня проекта
npm install
npm run dev        # сервер (3001) + клиент (5173)
```

Откройте http://localhost:5173, добавьте подключение (host/port/database/username/password).

## Безопасность

- **Пароли** хранятся только в памяти сервера: никогда не пишутся в SQLite и не возвращаются через API (в ответах вместо пароля — признак `hasPassword`).
- Имена схем/таблиц/колонок, приходящие из URL, валидируются (`assertIdent`) и экранируются через двойные кавычки — защита от SQL-инъекций.
- Режим только для чтения: приложение выполняет только `SELECT`.
- Пул соединений живёт на сервере, пароль БД не уходит в браузер.

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
│       ├── db.ts         # каталог + данные (pg_catalog)
│       └── routes/       # connections, catalog, table, export, logs
└── client/               # React SPA
    └── src/
        ├── store.ts      # zustand
        ├── api.ts
        ├── components/   # Topbar, Sidebar, DataView, StructureView, SqlView, модалки
        └── pages/        # Browser, Overview
```

## API (кратко)

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
| GET | `…/tables/:t/export?format=xlsx|csv` | экспорт |
| GET | `/api/connections/:id/databases/:db/stats` | размеры таблиц |
| GET | `/api/logs` | журнал запросов |

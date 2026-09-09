# Установка db_man под РЕД ОС

Пошаговая инструкция: развёртывание приложения на РЕД ОС, запуск через
systemd и публикация через nginx по адресу `http://SERVER/db_man`.

---

## 1. Требования

| Компонент | Требование |
|---|---|
| ОС | **РЕД ОС 8.x** (x86_64). РЕД ОС 7.3 **не подходит** (см. ниже) |
| Node.js | **22.13+** (LTS) — приложение использует встроенный `node:sqlite` |
| nginx | 1.18+ (в репозитории РЕД ОС 8 — 1.25) |
| PostgreSQL | целевая СУБД, к которой подключается db_man (может быть на другом хосте) |

> **Почему не РЕД ОС 7.3.** Приложение требует Node.js 22 (встроенный
> `node:sqlite`, доступен с 22.5, без флага `--experimental-sqlite` — с 22.13).
> Официальные бинарные сборки Node.js 22 собираются под glibc ≥ 2.28.
> В РЕД ОС 7.3 — glibc 2.17, в РЕД ОС 8 — glibc 2.36, поэтому требуется РЕД ОС 8.
> В штатном репозитории РЕД ОС 8 Node.js только 20.x (мало), поэтому Node 22
> ставится отдельно (раздел 2).

---

## 2. Установка Node.js 22

### 2.1 Из официального архива (рекомендуется, работает и офлайн)

```bash
# актуальную версию смотрите на https://nodejs.org/dist/latest-v22.x/
curl -O https://nodejs.org/dist/v22.22.3/node-v22.22.3-linux-x64.tar.xz
tar -xf node-v22.22.3-linux-x64.tar.xz -C /opt
ln -sf /opt/node-v22.22.3-linux-x64/bin/node /usr/local/bin/node
ln -sf /opt/node-v22.22.3-linux-x64/bin/npm  /usr/local/bin/npm

node -v   # v22.22.3
npm -v
```

### 2.2 Альтернатива — NodeSource (нужен доступ к интернету)

```bash
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs
```

---

## 3. Развёртывание приложения

```bash
mkdir -p /opt/db_man
cd /opt/db_man

# любой способ доставки исходников:
#   git clone https://github.com/gloryvictory/db_man.git .
#   или распаковать архив / scp на сервер

npm install        # установка зависимостей (сервер + клиент, workspaces)
npm run build      # сборка: server/dist (tsc) и client/dist (vite)
```

После сборки структура:

```
/opt/db_man
├── config.json          # централизованная конфигурация
├── server/
│   ├── dist/index.js    # собранный сервер (Express)
│   └── data/dbman.db    # SQLite (журнал, подключения) — создаётся при запуске
└── client/dist/         # собранный клиент (SPA)
```

---

## 4. Конфигурация

### 4.1 `config.json`

Отредактируйте `/opt/db_man/config.json`:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 3001,
    "sqlitePath": "./data/dbman.db"
  },
  "client": {
    "basePath": "/db_man"
  }
}
```

Ключевой параметр — `client.basePath`: префикс пути, под которым приложение
доступно через nginx. Задайте `/db_man`, чтобы приложение открывалось по
`http://SERVER/db_man`. Значение `""` — приложение в корне сайта.

> `basePath` «запекается» в сборку клиента, поэтому после его изменения нужно
> **пересобрать клиент**:

```bash
cd /opt/db_man && npm run build -w client
```

### 4.2 Переменные окружения (опционально)

Настройки сервера можно переопределить переменными окружения (приоритет выше
`config.json`): `HOST`, `PORT`, `SQLITE_PATH`.

---

## 5. systemd-сервис

Создайте `/etc/systemd/system/db_man.service`:

```ini
[Unit]
Description=db_man PostgreSQL browser
After=network.target

[Service]
Type=simple
User=dbman
Group=dbman
WorkingDirectory=/opt/db_man/server
ExecStart=/usr/local/bin/node dist/index.js
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Запуск:

```bash
# служебный пользователь без shell
useradd --system --home /opt/db_man --shell /sbin/nologin dbman

# права на каталог (серверу нужна запись в server/data для SQLite)
chown -R dbman:dbman /opt/db_man

systemctl daemon-reload
systemctl enable --now db_man
systemctl status db_man
```

Проверка, что сервер поднялся:

```bash
curl http://127.0.0.1:3001/api/health
# {"status":"ok","time":"..."}
```

---

## 6. nginx: прокси по адресу `http://SERVER/db_man`

```bash
dnf install -y nginx
```

Создайте `/etc/nginx/conf.d/db_man.conf`:

```nginx
server {
    listen 80;
    server_name SERVER;          # имя сервера или _ (любой)

    # без завершающего слэша — редирект на /db_man/
    location = /db_man {
        return 301 /db_man/;
    }

    # статика SPA
    location /db_man/ {
        alias /opt/db_man/client/dist/;
        try_files $uri $uri/ /db_man/index.html;
    }

    # API: /db_man/api/* -> http://127.0.0.1:3001/api/*
    location /db_man/api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 16m;
    }
}
```

Применение:

```bash
nginx -t
systemctl enable --now nginx
```

---

## 7. Firewall и SELinux

### 7.1 firewalld

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
```

Бэкенд слушает `127.0.0.1:3001` и наружу не торчит — открывать его не нужно.

### 7.2 SELinux

Если SELinux включён в enforcing-режиме, разрешите nginx читать статику и
ходить сетью к бэкенду:

```bash
semanage fcontext -a -t httpd_sys_content_t "/opt/db_man/client/dist(/.*)?"
restorecon -Rv /opt/db_man/client/dist

# разрешить nginx проксировать на 127.0.0.1:3001
setsebool -P httpd_can_network_connect 1
```

---

## 8. Проверка

```bash
# бэкенд напрямую
curl http://127.0.0.1:3001/api/health

# через nginx
curl -I http://SERVER/db_man/
curl http://SERVER/db_man/api/health
```

Затем откройте `http://SERVER/db_man` в браузере, создайте подключение к
PostgreSQL и проверьте дерево баз/таблиц.

---

## 9. Обновление приложения

```bash
cd /opt/db_man
git pull            # или доставить новый архив/исходники
npm install
npm run build
systemctl restart db_man
```

---

## 10. Примечания по безопасности

- Пароли подключений по умолчанию хранятся **только в памяти** сервера.
  При включении чекбокса «Сохранить пароль» пароль пишется в SQLite
  (`server/data/dbman.db`, таблица `connection_secrets`) в открытом виде.
  Ограничьте доступ к каталогу `server/data` правами (`chmod 700`) и не
  отдавайте файл наружу.
- Файл `server/data/dbman.db` содержит журнал запросов (в т.ч. текст SQL) —
  учитывайте это при резервном копировании и разграничении доступа.
- Имена схем/таблиц/колонок экранируются (`quote_ident`) — защита от
  SQL-инъекций; пароли через API не возвращаются (только признак
  `hasPassword`/`hasSavedPassword`).

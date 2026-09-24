import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

interface AppConfig {
  server: { host: string; port: number; sqlitePath: string };
  client: { host: string; port: number; apiProxy: string };
}

const DEFAULTS: AppConfig = {
  server: { host: '127.0.0.1', port: 3001, sqlitePath: './data/dbman.db' },
  client: { host: '127.0.0.1', port: 5173, apiProxy: 'http://127.0.0.1:3001' },
};

function loadFileConfig(): AppConfig {
  // config.json лежит в корне проекта (на два уровня выше server/src или server/dist)
  const p = path.resolve(__dirname, '../../config.json');
  try {
    if (fs.existsSync(p)) {
      const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<AppConfig>;
      return {
        server: { ...DEFAULTS.server, ...(raw.server ?? {}) },
        client: { ...DEFAULTS.client, ...(raw.client ?? {}) },
      };
    }
  } catch (e) {
    console.warn('[config] не удалось прочитать config.json:', (e as Error).message);
  }
  return DEFAULTS;
}

const fileCfg = loadFileConfig();

function resolveSqlitePath(p: string): string {
  if (p === ':memory:' || path.isAbsolute(p)) return p;
  // относительный путь — от папки сервера (server/), а не от текущей рабочей директории
  const serverDir = path.resolve(__dirname, '..'); // server/src → server/, server/dist → server/
  return path.resolve(serverDir, p);
}

export const config = {
  // переменные окружения (server/.env) имеют приоритет над config.json
  host: process.env.HOST || fileCfg.server.host,
  port: parseInt(process.env.PORT || String(fileCfg.server.port), 10),
  sqlitePath: resolveSqlitePath(process.env.SQLITE_PATH || fileCfg.server.sqlitePath),
};

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

interface ClientConfig {
  host?: string;
  port?: number;
  apiProxy?: string;
  basePath?: string;
}

function loadConfig(): { client?: ClientConfig } {
  // при запуске через npm workspaces cwd = client/, config.json — на уровень выше
  const candidates = [path.resolve(process.cwd(), '../config.json'), path.resolve(process.cwd(), 'config.json')];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (e) {
        console.warn('[vite] не удалось прочитать config.json:', (e as Error).message);
      }
    }
  }
  return {};
}

const cfg = loadConfig();
const client = cfg.client ?? {};

export default defineConfig({
  plugins: [react()],
  // базовый путь приложения: пустая строка -> корень, "/db_man" -> http://SERVER/db_man
  base: client.basePath ? client.basePath + '/' : '/',
  server: {
    host: client.host ?? '127.0.0.1',
    port: Number(client.port ?? 5173),
    proxy: {
      '/api': client.apiProxy ?? 'http://127.0.0.1:3001',
    },
  },
});

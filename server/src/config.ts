import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  sqlitePath: process.env.SQLITE_PATH || './data/dbman.db',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};

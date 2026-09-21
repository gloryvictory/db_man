// Дружелюбные сообщения об ошибках подключения.
// Ошибки аутентификации PostgreSQL приходят ДО установки client_encoding, поэтому
// на серверах с локалью вида Russian_Russia.1251 их текст приходит в WIN1251 и
// читается pg как UTF-8 → «кракозябры» (байты теряются, остаются U+FFFD).
// Восстановить исходный текст нельзя — маппим по коду ошибки (e.code).

const PG_CODES: Record<string, string> = {
  '28P01': 'Неверный логин или пароль',
  '28000': 'Ошибка авторизации (проверьте pg_hba.conf)',
  '3D000': 'База данных не существует',
  '57P03': 'Сервер недоступен (запускается или перезагружается)',
  '53300': 'Слишком много подключений к серверу',
  '57P01': 'Подключение завершено администратором',
  '08P01': 'Ошибка протокола подключения',
};

const NET_CODES: Record<string, string> = {
  ECONNREFUSED: 'Не удалось подключиться к серверу (порт закрыт или PostgreSQL не запущен)',
  ENOTFOUND: 'Не удалось найти сервер (проверьте адрес)',
  EAI_AGAIN: 'Не удалось разрешить имя сервера (проверьте адрес)',
  ETIMEDOUT: 'Превышено время ожидания подключения',
  ECONNRESET: 'Соединение разорвано сервером',
};

export function friendlyPgError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string })?.code;

  if (code && PG_CODES[code]) return PG_CODES[code];
  if (code && NET_CODES[code]) return NET_CODES[code];

  // кодировочный мусор (U+FFFD) — сообщение сервера в несовместимой кодировке
  if (msg.includes('\uFFFD')) {
    return code ? `Ошибка подключения (код ${code})` : 'Не удалось подключиться к базе данных';
  }

  return msg;
}

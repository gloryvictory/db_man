import { logAudit, getConnection } from './sqlite';

interface AuditMeta {
  connId: string;
  action: string;
  target: string;
  detail?: string;
}

// Выполняет операцию обслуживания и пишет её в журнал аудита (успех/ошибка).
export async function audited(meta: AuditMeta, fn: () => Promise<void>): Promise<void> {
  const username = getConnection(meta.connId)?.username ?? null;
  try {
    await fn();
    logAudit({ username, action: meta.action, target: meta.target, detail: meta.detail ?? null, status: 'ok', error: null });
  } catch (e) {
    logAudit({
      username,
      action: meta.action,
      target: meta.target,
      detail: meta.detail ?? null,
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

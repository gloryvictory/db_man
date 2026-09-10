import { logAudit } from './sqlite';
import { currentUser } from './auth';

interface AuditMeta {
  connId: string;
  action: string;
  target: string;
  detail?: string;
}

// Выполняет операцию обслуживания и пишет её в журнал аудита (успех/ошибка).
export async function audited(meta: AuditMeta, fn: () => Promise<void>): Promise<void> {
  const u = currentUser();
  try {
    await fn();
    logAudit({
      user_id: u?.id ?? null,
      username: u?.login ?? null,
      action: meta.action,
      target: meta.target,
      detail: meta.detail ?? null,
      status: 'ok',
      error: null,
    });
  } catch (e) {
    logAudit({
      user_id: u?.id ?? null,
      username: u?.login ?? null,
      action: meta.action,
      target: meta.target,
      detail: meta.detail ?? null,
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

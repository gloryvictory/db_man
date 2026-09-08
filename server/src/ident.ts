const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_$]*$/;

/**
 * Validate a user-supplied identifier (schema/table/column name from the URL).
 * Rejects anything that is not a plain identifier to prevent SQL injection.
 */
export function assertIdent(name: unknown, kind = 'identifier'): string {
  if (typeof name !== 'string' || !IDENT_RE.test(name)) {
    const err = new Error(`Недопустимый ${kind}: ${String(name)}`) as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  return name;
}

/** Quote any identifier (catalog names are trusted; only escape embedded quotes). */
export function quote(name: string): string {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

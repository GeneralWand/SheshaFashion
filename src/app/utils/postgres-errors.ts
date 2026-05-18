/** PostgreSQL `unique_violation` — message often contains "duplicate key" for any unique index, not only email. */
const PG_UNIQUE_VIOLATION = '23505';

function uniqueViolationBlob(err: unknown): string {
  if (err == null || typeof err !== 'object') return '';
  const e = err as { message?: string; details?: string; hint?: string };
  return `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`.toLowerCase();
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === PG_UNIQUE_VIOLATION;
}

/** Use for user-facing "email already registered" — avoids mislabeling other duplicate keys (e.g. `user_id` on `drivers`). */
export function isUsersEmailUniqueViolation(err: unknown): boolean {
  if (!isUniqueViolation(err)) return false;
  const blob = uniqueViolationBlob(err);
  return blob.includes('email') || blob.includes('(email)');
}

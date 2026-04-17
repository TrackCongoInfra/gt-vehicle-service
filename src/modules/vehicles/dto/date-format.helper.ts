/**
 * Date parsing helpers for the vehicle DTOs.
 *
 * The web UI sends dates as `dd/MM/yyyy` (e.g. "21/04/2025"). We accept that
 * format PLUS any ISO 8601 string the backend would natively consume, so
 * integrations and the UI can share a single DTO.
 *
 * Invalid strings pass through unchanged so class-validator can still flag
 * them with @IsDateString — no silent coercion to "Invalid Date".
 */

const DDMMYYYY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Convert `dd/MM/yyyy` to `yyyy-MM-dd`. Pass-through if already ISO.
 * Returns the original input for anything else (validator will reject it).
 */
export function coerceToIsoDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  const m = DDMMYYYY_REGEX.exec(trimmed);
  if (!m) return trimmed; // might already be ISO — let validator decide

  const [, dd, mm, yyyy] = m;
  // Quick sanity check
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) {
    return trimmed;
  }
  return `${yyyy}-${mm}-${dd}`;
}

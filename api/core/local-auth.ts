// QQ-email local accounts: validation rules and account identity. Kept
// separate from handler.ts so the rules are unit-testable without HTTP.
//
// Scope of the feature, as specified by the product owner:
//   - only QQ mailboxes are accepted
//   - only the numeric QQ address is accepted, no letters before the @
//   - a mailbox is <digits>@qq.com, derived from the digits, so the mailbox
//     is never an independent identity on the account record

export const QQ_EMAIL_DOMAIN = 'qq.com';

/** QQ numbers are 5-11 digits in practice; keep the bound explicit and testable. */
const QQ_MIN_DIGITS = 5;
const QQ_MAX_DIGITS = 11;

/** Password length bounds are policy, not crypto. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export type QqValidationError =
  | 'qqRequired'
  | 'qqNotNumeric'
  | 'qqTooShort'
  | 'qqTooLong'
  | 'emailRequired'
  | 'emailNotQq'
  | 'emailMismatch'
  | 'passwordTooShort'
  | 'passwordTooLong';

export interface QqAccountInput {
  /** Full mailbox as typed, e.g. 123456@qq.com. */
  email: string;
  /** Numeric QQ id as typed; surrounding whitespace is tolerated. */
  qq: string;
  password: string;
}

export interface QqAccount {
  qq: string;
  email: string;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

/**
 * Normalize a raw mailbox: lowercase it and strip surrounding whitespace.
 * The local part is digits anyway, so lowercasing is safe for both halves.
 */
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** The canonical mailbox for a numeric QQ id. */
export function qqEmailFor(qq: string): string {
  return qq + '@' + QQ_EMAIL_DOMAIN;
}

/**
 * Validate a registration payload, returning a specific error code the client
 * maps to a localized message, or null when the account is acceptable.
 */
export function validateQqAccount(input: Partial<QqAccountInput>): QqValidationError | null {
  const email = normalizeEmail(str(input.email));
  if (!email) return 'emailRequired';

  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return 'emailNotQq';

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  // QQ-only: no subdomains, no aliases, exactly the qq.com domain.
  if (domain !== QQ_EMAIL_DOMAIN) return 'emailNotQq';

  // The owner asked for numeric-only addresses, so reject letters with a
  // dedicated code rather than letting the qq check report something vague.
  if (!/^[0-9]+$/.test(local)) return 'qqNotNumeric';

  const qq = str(input.qq).trim();
  if (!qq) return 'qqRequired';
  if (!/^[0-9]+$/.test(qq)) return 'qqNotNumeric';
  if (qq.length < QQ_MIN_DIGITS) return 'qqTooShort';
  if (qq.length > QQ_MAX_DIGITS) return 'qqTooLong';

  // The two identifiers must agree, otherwise the mailbox would route to an
  // account other than the one being registered.
  if (local !== qq) return 'emailMismatch';

  const password = str(input.password);
  if (password.length < MIN_PASSWORD_LENGTH) return 'passwordTooShort';
  if (password.length > MAX_PASSWORD_LENGTH) return 'passwordTooLong';

  return null;
}

/**
 * Acceptance check for a row read from the credentials table. The row is
 * untrusted input, so the digit and mailbox-consistency rules are re-applied
 * before it is allowed to answer a login request.
 */
export function isAcceptableQqAccount(row: { qq?: unknown; email?: unknown } | null): boolean {
  if (!row) return false;
  const qq = str(row.qq);
  const email = str(row.email).toLowerCase();
  return /^[0-9]{5,11}$/.test(qq) && email === qqEmailFor(qq);
}

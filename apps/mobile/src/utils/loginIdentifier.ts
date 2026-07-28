// Pure helpers for the login screen: decide whether the identifier typed in
// the "email" field is a staff username (no '@') or an email address.

const MIN_USERNAME_LENGTH = 3;

/** True when the input should be treated as a staff username (no '@'). */
export function isUsernameIdentifier(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.length >= MIN_USERNAME_LENGTH && !trimmed.includes('@');
}

/** True when the input looks like an email address usable with Supabase. */
export function isEmailIdentifier(input: string): boolean {
  return input.trim().includes('@');
}

/** Backend usernames are stored lowercase — normalize before sending. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

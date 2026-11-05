const HEX = /^#[0-9a-f]{6}$/i

/** `#rrggbb` only (the same rule as the `cv_preferences.accent` check constraint). Own module: tiny, shared by every page. */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value)
}

/**
 * Where to go after login. `from` comes from router state set by RequireAuth,
 * but we still accept only same-site absolute paths (no "//host", no /login loop).
 */
export function safeRedirectPath(from: unknown): string {
  if (
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !from.startsWith('/login')
  ) {
    return from;
  }
  return '/';
}

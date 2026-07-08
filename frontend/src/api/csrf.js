// Reads the (deliberately non-httpOnly) csrf_token cookie so it can be echoed
// back as a header on state-changing auth requests (refresh/logout). This is
// the "double submit cookie" CSRF pattern: a cross-site attacker can trigger
// the cookie to be sent automatically, but can't read its value to also set
// the matching header, since that requires same-origin JS access.
export function readCsrfCookie() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

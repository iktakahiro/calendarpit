import type { User } from '../../model/directory';
import type { Consent } from '../../model/oauth';

/** Escapes text for HTML element and attribute content. */
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
/**
 * Renders the consent page where the developer picks a test user and
 * approves or denies the request. No real Google account is involved.
 *
 * @param nonce - Single-use value tying the form post to the stored consent.
 * @param users - Selectable test users. Approve is disabled without users.
 */
export function renderConsentPage(
  data: Consent,
  nonce: string,
  users: User[],
): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect your calendar · Calendarpit</title><style>body{background:#f5f3ee;color:#292b27;font:16px system-ui;max-width:600px;margin:8vh auto;padding:24px}h1{font-size:36px}form{background:#fffdf8;padding:28px;border:1px solid #dfdfd6;border-radius:12px}label,select{display:block;margin:18px 0}select,button{font:inherit;padding:12px;border-radius:6px;border:1px solid #aaa}button{cursor:pointer}button[value=approve]{background:#b9502d;color:white}li{overflow-wrap:anywhere;font-size:13px;margin:8px 0}</style></head><body><p>CALENDARPIT / LOCAL AUTHORIZATION</p><h1>Connect your calendar.</h1><p><strong>${escape(data.clientId)}</strong> wants access to a test account.</p><form method="post" action="/oauth/authorize"><input type="hidden" name="consent" value="${nonce}"><label for="user">Test user</label><select id="user" name="user_id">${users.map((u) => `<option value="${escape(u.id)}">${escape(u.name)} · ${escape(u.email)}</option>`).join('')}</select><p>Requested permissions</p><ul>${data.scope.map((s) => `<li>${escape(s)}</li>`).join('')}</ul><button name="decision" value="approve" ${users.length ? '' : 'disabled'}>Approve</button> <button name="decision" value="deny">Deny</button><p>This is a local test service. No real Google account is used.</p></form></body></html>`;
}

/**
 * Security headers for the consent page. The CSP allows posting the form only
 * to this origin and to the client's redirect origin, and forbids framing.
 */
export function consentPageHeaders(data: Consent): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${new URL(data.redirectUri).origin}; frame-ancestors 'none'`,
    'Referrer-Policy': 'same-origin',
  };
}

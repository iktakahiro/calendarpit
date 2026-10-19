import type { Snapshot } from '@calendarpit/server';
import type { Messages } from '../../../lib/messages';

/** An OAuth client as the snapshot shows it, without its secret. */
export type ClientSummary = Snapshot['clients'][number];

/** Editable fields of an OAuth client. Redirect URIs are one per line. */
export type ClientFormValues = {
  id: string;
  secret: string;
  redirectUris: string;
};

/** Field errors keyed by field name. */
export type ClientFormErrors = Partial<Record<keyof ClientFormValues, string>>;

/**
 * Returns form values for editing `client`, or empty values for a new one.
 * The secret always starts blank because the snapshot never contains it.
 */
export const clientFormValues = (client?: ClientSummary): ClientFormValues => ({
  id: client?.id ?? '',
  secret: '',
  redirectUris: client?.redirectUris.join('\n') ?? '',
});

/** Splits the redirect URI field into trimmed, nonblank lines. */
export const redirectUriLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/** Whether a redirect URI meets the server's rules for registered URIs. */
function isRedirectUri(text: string) {
  try {
    const url = new URL(text);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

/**
 * Checks a client form before it reaches the server, which validates again.
 * A new client needs an ID and a secret; an existing client keeps its secret
 * when the field is left blank. Errors are written in the language of `t`.
 *
 * @returns Field errors, or `undefined` when the values look valid.
 */
export function validateClientForm(
  values: ClientFormValues,
  creating: boolean,
  t: Messages,
): ClientFormErrors | undefined {
  const errors: ClientFormErrors = {};
  const id = values.id.trim();
  if (creating && (!/^[a-zA-Z0-9@._-]{1,128}$/.test(id) || id === 'primary'))
    errors.id = t['clients.errorId'];
  if (creating && !values.secret) errors.secret = t['clients.errorSecret'];
  const uris = redirectUriLines(values.redirectUris);
  if (!uris.length) errors.redirectUris = t['clients.errorRedirectMissing'];
  else if (!uris.every(isRedirectUri))
    errors.redirectUris = t['clients.errorRedirectInvalid'];
  return Object.keys(errors).length ? errors : undefined;
}

/**
 * Builds the management API body for a client form. Editing omits the ID,
 * which is immutable, and a blank secret, which keeps the current one.
 */
export function clientPayload(values: ClientFormValues, creating: boolean) {
  return {
    ...(creating ? { id: values.id.trim() } : {}),
    ...(values.secret ? { secret: values.secret } : {}),
    redirectUris: redirectUriLines(values.redirectUris),
  };
}

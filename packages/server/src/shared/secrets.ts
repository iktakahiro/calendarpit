/**
 * Creates an opaque, unguessable token with 244 random bits. It is used for
 * OAuth codes, access and refresh tokens, consent nonces, and page cursors.
 */
export const secret = () =>
  crypto.randomUUID().replaceAll('-', '') +
  crypto.randomUUID().replaceAll('-', '');

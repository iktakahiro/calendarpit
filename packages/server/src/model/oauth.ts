/** A registered OAuth client. Only exact redirect URI matches are accepted. */
export type Client = { id: string; secret: string; redirectUris: string[] };

/**
 * A user's consent for one client, also shown as a connection in the admin UI.
 * Revoking it invalidates all of its tokens and stops its watch channels.
 */
export type Grant = {
  id: string;
  userId: string;
  clientId: string;
  scopes: string[];
  revoked: boolean;
  /** ISO timestamp of the consent. */
  created: string;
};

/** An access or refresh token bound to a grant. */
export type Token = {
  grantId: string;
  /** Epoch milliseconds. Refresh tokens use `Infinity`. */
  expires: number;
};

/** A single-use authorization code waiting for the token exchange. */
export type Code = {
  grantId: string;
  redirectUri: string;
  /** Epoch milliseconds. */
  expires: number;
  /** PKCE S256 challenge, when the client sent one. */
  challenge?: string;
  /** Whether `access_type=offline` asked for a refresh token. */
  offline: boolean;
};

/** A validated authorization request waiting for the user's decision. */
export type Consent = {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state?: string;
  challenge?: string;
  offline: boolean;
  /** Epoch milliseconds. */
  expires: number;
};

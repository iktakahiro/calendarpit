/**
 * One recorded Calendar or OAuth HTTP exchange. Secrets are redacted before
 * the record is stored.
 */
export type History = {
  id: string;
  time: string;
  method: string;
  path: string;
  status: number;
  request: unknown;
  response: unknown;
  headers: unknown;
  responseHeaders: unknown;
};

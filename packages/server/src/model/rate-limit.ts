/**
 * Simulated Calendar API quota mode saved with the workspace.
 *
 * `off` applies no limits. `prod` follows Google's published per-minute quotas.
 * `strict` uses lower ceilings so quota errors are easy to hit locally.
 */
export type RateLimitMode = 'off' | 'prod' | 'strict';

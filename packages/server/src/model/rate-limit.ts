/**
 * Simulated Calendar API quota mode saved with the workspace.
 *
 * `off` applies no limits. `production` roughly follows Google's published
 * per-minute quotas. `error-test` uses very low ceilings so quota errors are
 * easy to hit locally.
 */
export type RateLimitMode = 'off' | 'production' | 'error-test';

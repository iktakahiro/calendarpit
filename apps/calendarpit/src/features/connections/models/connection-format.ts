const scopePrefix = 'https://www.googleapis.com/auth/';

/** Shortens a Google scope URL to its suffix, such as `calendar.readonly`. */
export const scopeLabel = (scope: string) =>
  scope.startsWith(scopePrefix) ? scope.slice(scopePrefix.length) : scope;

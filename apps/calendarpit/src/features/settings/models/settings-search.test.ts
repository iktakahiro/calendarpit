import { expect, test } from 'bun:test';
import { parseSettingsSearch } from './settings-search';

test.each(['developer', 'data', 'clients'] as const)(
  'accepts the %s Settings tab',
  (tab) => expect(parseSettingsSearch({ tab })).toEqual({ tab }),
);

test.each(
  [
    undefined,
    'appearance',
    'unknown',
    '',
    'Developer',
    1,
    null,
    ['data'],
    {},
  ].map((tab) => ({ tab })),
)(
  'falls back to Appearance for %p and omits the default from links',
  ({ tab }) => expect(parseSettingsSearch({ tab })).toEqual({ tab: undefined }),
);

test('leaves workspace search validation to the parent route', () => {
  expect(
    parseSettingsSearch({ user: 'sam', calendar: 'sam-work', tab: 'data' }),
  ).toEqual({ tab: 'data' });
});

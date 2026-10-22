import { expect, test } from 'bun:test';
import { messages } from '../../../lib/messages';
import { parseFixtureJson } from './fixture-json';

test.each(['', ' ', '{', '{"users": [}', '{"users": [],}', '{users: []}'])(
  'rejects malformed JSON %p with a localized recovery message',
  (text) => {
    for (const t of [messages.en, messages.ja])
      expect(parseFixtureJson(text, t)).toEqual({
        valid: false,
        error: t['settings.fixtureJsonError'],
      });
  },
);

test.each([
  '{}',
  ' {"users": [], "clients": []}\n',
  '{"users": "invalid schema"}',
  'null',
  '[]',
  '42',
])('parses JSON %p and leaves schema validation to the server', (text) =>
  expect(parseFixtureJson(text, messages.en)).toEqual({
    valid: true,
    value: JSON.parse(text),
  }),
);

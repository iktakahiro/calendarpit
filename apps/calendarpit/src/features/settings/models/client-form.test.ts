import { expect, test } from 'bun:test';
import { messages } from '../../../lib/messages';
import { clientPayload, validateClientForm } from './client-form';

const callback = 'http://127.0.0.1:3000/callback';

test.each([
  [{ id: 'my-app', secret: 's', redirectUris: callback }, true, undefined],
  [{ id: '', secret: '', redirectUris: callback }, false, undefined],
  [
    { id: 'primary', secret: '', redirectUris: '' },
    true,
    {
      id: 'Use 1–128 letters, digits, or @ . _ - characters.',
      secret: 'Enter a client secret.',
      redirectUris: 'Enter at least one redirect URI.',
    },
  ],
  [
    { id: '', secret: '', redirectUris: `${callback}\nmyapp://callback` },
    false,
    {
      redirectUris:
        'Use absolute http or https URLs without a fragment or credentials.',
    },
  ],
])('validateClientForm(%p, %p)', (values, creating, expected) => {
  expect(validateClientForm(values, creating, messages.en)).toEqual(expected);
});

test('validateClientForm writes errors in the given language', () => {
  expect(
    validateClientForm(
      { id: 'my-app', secret: 's', redirectUris: '' },
      true,
      messages.ja,
    ),
  ).toEqual({ redirectUris: 'リダイレクト URI を1つ以上入力してください。' });
});

test('clientPayload trims lines and keeps a blank secret on edit', () => {
  const values = {
    id: ' my-app ',
    secret: '',
    redirectUris: ` ${callback} \n\nhttp://localhost:3000/callback\n`,
  };
  expect(clientPayload(values, false)).toEqual({
    redirectUris: [callback, 'http://localhost:3000/callback'],
  });
  expect(clientPayload({ ...values, secret: 'new' }, true)).toEqual({
    id: 'my-app',
    secret: 'new',
    redirectUris: [callback, 'http://localhost:3000/callback'],
  });
});

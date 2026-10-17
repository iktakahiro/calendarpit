import { expect, test } from 'bun:test';
import type { Consent } from '../../model/oauth';
import { consentPageHeaders, renderConsentPage } from './consent-page';

const consent: Consent = {
  clientId: '<script>alert(1)</script>',
  redirectUri: 'http://127.0.0.1:4175/callback',
  scope: ['openid'],
  offline: false,
  expires: 0,
};

test('escapes client and user text', () => {
  const html = renderConsentPage(consent, 'nonce', [
    { id: 'u"1', name: "O'Neil & <Co>", email: 'o@example.test' },
  ]);
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html).toContain('value="u&quot;1"');
  expect(html).toContain('O&#39;Neil &amp; &lt;Co&gt;');
});

test('disables approval when there are no users', () => {
  expect(renderConsentPage(consent, 'nonce', [])).toContain(
    'value="approve" disabled',
  );
});

test('limits form posts to this origin and the redirect origin', () => {
  expect(consentPageHeaders(consent)['Content-Security-Policy']).toContain(
    "form-action 'self' http://127.0.0.1:4175;",
  );
});

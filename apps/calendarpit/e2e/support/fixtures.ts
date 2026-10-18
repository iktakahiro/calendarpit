import { test as base, expect, type Page } from '@playwright/test';

/**
 * Playwright `test` that resets the workspace to its startup fixture before
 * every test, so tests never depend on each other's data.
 */
export const test = base.extend<{ cleanWorkspace: void }>({
  cleanWorkspace: [
    async ({ request }, use) => {
      const response = await request.post('/__calendarpit/reset', {
        data: {},
      });
      expect(response.ok()).toBe(true);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/** The sample OAuth client and its registered redirect URI from the fixture. */
export const sampleClient = {
  id: 'sample-app',
  redirectUri: 'http://127.0.0.1:4175/callback',
};

/**
 * A toast with `message`, inside the Kumo toast viewport. Toasts stack, so the
 * message is matched instead of the region's whole text.
 */
export const toast = (page: Page, message: string) =>
  page
    .getByRole('region', { name: 'Notifications' })
    .getByText(message, { exact: true });

/** A section button in the sidebar navigation. */
export const sectionLink = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Workspace sections' })
    .getByRole('button', { name });

/**
 * Runs `action` and returns the URL the consent form redirects to.
 *
 * The browser submits the form as usual, but the server's 302 is read
 * instead of followed: nothing serves the client callback, and route handlers
 * never see requests that follow a redirect.
 */
export async function redirectAfter(page: Page, action: () => Promise<void>) {
  let location: string | undefined;
  await page.route('**/oauth/authorize', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const response = await route.fetch({ maxRedirects: 0 });
    location = response.headers().location;
    await route.fulfill({ status: 200, body: 'Redirect captured.' });
  });
  await Promise.all([page.waitForLoadState('load'), action()]);
  await expect.poll(() => location).toBeTruthy();
  await page.unroute('**/oauth/authorize');
  return new URL(location!);
}

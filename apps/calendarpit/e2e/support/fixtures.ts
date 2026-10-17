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

/** The success toast, a polite status region at the bottom of the shell. */
export const toast = (page: Page) =>
  page.locator('.toasts').getByRole('status');

/** A section button in the sidebar navigation. */
export const sectionLink = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Workspace sections' })
    .getByRole('button', { name });

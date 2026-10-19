import type { Page } from '@playwright/test';
import { expect, test, toast } from './support/fixtures';

/**
 * Opens `url` and waits until shortcuts work. The shortcut listener starts
 * when the page hydrates, and React does not replay key presses made before
 * that, as it replays clicks.
 */
async function gotoWithShortcuts(page: Page, url: string) {
  await page.goto(url);
  const palette = page.getByRole('dialog');
  await expect(async () => {
    await page.keyboard.press('?');
    await expect(palette).toBeVisible({ timeout: 250 });
  }).toPass();
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);
}

test.describe('command palette', () => {
  test('opens from the keyboard and the header, and goes to a section', async ({
    page,
  }) => {
    await page.goto('/');
    const palette = page.getByRole('dialog');

    await page.getByRole('button', { name: /^Commands/ }).click();
    await expect(
      palette.getByRole('combobox', { name: 'Search commands' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+k');
    await palette
      .getByRole('combobox', { name: 'Search commands' })
      .fill('api');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/history/);
    await expect(
      page.getByRole('heading', { name: 'API history' }),
    ).toBeVisible();
    await expect(palette).toHaveCount(0);

    // `?` opens the same palette, which lists every shortcut.
    await page.keyboard.press('?');
    await expect(
      palette.getByRole('option', { name: /^New event/ }),
    ).toBeVisible();
  });

  test('moves through results with the arrow keys and reopens empty', async ({
    page,
  }) => {
    await gotoWithShortcuts(page, '/history');
    const palette = page.getByRole('dialog');
    const search = palette.getByRole('combobox', { name: 'Search commands' });

    await page.keyboard.press('ControlOrMeta+k');
    await search.fill('theme');
    const option = (name: string) =>
      palette.getByRole('option', { name: new RegExp(`^${name}`) });
    await expect(option('Theme: Light')).toHaveAttribute('data-highlighted');
    await page.keyboard.press('ArrowDown');
    await expect(option('Theme: Dark')).toHaveAttribute('data-highlighted');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await expect(option('Theme: Dark')).toHaveAttribute('data-highlighted');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');

    // Reopening during the closing animation still starts a new search.
    await page.keyboard.press('ControlOrMeta+k');
    await expect(search).toHaveValue('');
  });

  test('finds sections by their Japanese names', async ({ page }) => {
    await gotoWithShortcuts(page, '/');
    const palette = page.getByRole('dialog');

    await page.keyboard.press('ControlOrMeta+k');
    await palette
      .getByRole('combobox', { name: 'Search commands' })
      .fill('ユーザー');
    await expect(palette.getByRole('option', { name: /^Users/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/users/);
  });

  test('creates an event with a shortcut from another section', async ({
    page,
  }) => {
    await gotoWithShortcuts(page, '/users');
    await expect(
      page.getByRole('heading', { name: 'Users', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('c');

    await expect(page).toHaveURL(/\/\?.*event=new/);
    const editor = page.getByRole('region', { name: 'Event editor' });
    await expect(editor).toBeFocused();
    // The editor keeps single keys, so typing never leaves the new event.
    await page.keyboard.press('n');
    await expect(page).toHaveURL(/event=new/);

    await editor.getByLabel('Summary', { exact: true }).fill('Standup');
    await editor.getByRole('button', { name: 'Save event' }).click();
    await expect(toast(page, 'Event saved.')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Standup/ })).toBeVisible();
  });

  test('ignores single-key shortcuts while typing in a field', async ({
    page,
  }) => {
    await gotoWithShortcuts(page, '/history');
    const filter = page.getByLabel('Filter requests');
    await filter.click();
    await page.keyboard.type('cgtw?');
    await expect(filter).toHaveValue('cgtw?');
    await expect(page).toHaveURL(/\/history$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('jumps to a date, changes the view, and switches calendars', async ({
    page,
  }) => {
    await gotoWithShortcuts(page, '/?date=2026-10-19');
    await expect(
      page.getByRole('heading', { name: 'Work calendar' }),
    ).toBeVisible();
    const palette = page.getByRole('dialog');

    await page.keyboard.press('g');
    const prompt = palette.getByRole('combobox', { name: 'Go to date' });
    await prompt.fill('+3');
    await expect(
      palette.getByRole('option', { name: /Thursday, October 22, 2026/ }),
    ).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/date=2026-10-22/);

    await page.keyboard.press('w');
    await expect(
      page.getByRole('button', { name: 'Week', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    // In week view, the next period is a week.
    await page.keyboard.press('n');
    await expect(page).toHaveURL(/date=2026-10-29/);

    // Backspace in an empty page prompt returns to every command.
    await page.keyboard.press('g');
    await expect(prompt).toBeFocused();
    await page.keyboard.press('Backspace');
    const search = palette.getByRole('combobox', { name: 'Search commands' });
    await search.fill('personal');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Personal' })).toBeVisible();
    await expect(page).toHaveURL(/date=2026-10-29/);
  });
});

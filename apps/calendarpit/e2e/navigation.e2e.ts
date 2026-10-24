import type { Locator } from '@playwright/test';
import { expect, sectionLink, test } from './support/fixtures';

async function expectActiveInsideStrip(navigation: Locator) {
  await expect
    .poll(() =>
      navigation.evaluate((nav) => {
        const active = nav.querySelector('[aria-current="page"]');
        if (!active) return false;
        const strip = nav.getBoundingClientRect();
        const button = active.getBoundingClientRect();
        return button.left >= strip.left && button.right <= strip.right;
      }),
    )
    .toBe(true);
}

test.describe('mobile section navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test(`direct links reveal the active section with ${reducedMotion} motion`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      const navigation = page.getByRole('navigation', {
        name: 'Workspace sections',
      });
      for (const name of ['Connections', 'Users', 'Calendars', 'Settings']) {
        await page.goto(`/${name.toLowerCase()}`);
        await expect(sectionLink(page, name)).toHaveAttribute(
          'aria-current',
          'page',
        );
        await expectActiveInsideStrip(navigation);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      }
    });
  }

  test('edge cues show which side of the strip has hidden sections', async ({
    page,
  }) => {
    const frame = page.locator('.rail-nav-frame');
    const navigation = page.getByRole('navigation', {
      name: 'Workspace sections',
    });

    await page.goto('/');
    await expectActiveInsideStrip(navigation);
    await expect(frame).toHaveAttribute('data-overflow-after', 'true');
    await expect(frame).not.toHaveAttribute('data-overflow-before');

    await page.goto('/settings');
    await expectActiveInsideStrip(navigation);
    await expect(frame).toHaveAttribute('data-overflow-before', 'true');
    await expect(frame).not.toHaveAttribute('data-overflow-after');

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(frame).not.toHaveAttribute('data-overflow-before');
    await expect(frame).not.toHaveAttribute('data-overflow-after');
  });

  test('section changes, history, resizing, and keyboard focus keep navigation usable', async ({
    page,
  }) => {
    await page.goto('/connections');
    const navigation = page.getByRole('navigation', {
      name: 'Workspace sections',
    });
    await expectActiveInsideStrip(navigation);

    // A click waits for hydration before using the Settings shortcut.
    await sectionLink(page, 'Connections').click();
    await page.keyboard.press('ControlOrMeta+,');
    await expect(page).toHaveURL(/\/settings/);
    await expect(sectionLink(page, 'Settings')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expectActiveInsideStrip(navigation);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await sectionLink(page, 'Settings').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(sectionLink(page, 'Calendars')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(sectionLink(page, 'Calendars')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(sectionLink(page, 'Calendars')).toBeFocused();
    await expectActiveInsideStrip(navigation);

    await page.goBack();
    await expect(sectionLink(page, 'Settings')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expectActiveInsideStrip(navigation);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect
      .poll(() => navigation.evaluate((nav) => nav.scrollLeft))
      .toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectActiveInsideStrip(navigation);
  });
});

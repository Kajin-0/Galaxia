import { expect, test, type Page } from '@playwright/test';

const waitForCommandDeck = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Galaxia' })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#splash-screen')).toHaveCount(0, { timeout: 5_000 });
};

const expectRenderedShips = async (page: Page) => {
  const canvases = page.locator('canvas[data-hero]');
  await expect(canvases).toHaveCount(3);
  const nonTransparentPixels = await canvases.evaluateAll(elements => elements.map(element => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) count += 1;
    }
    return count;
  }));
  expect(nonTransparentPixels.every(count => count > 100)).toBe(true);
};

const seedProgression = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('galaxiaProgression', JSON.stringify({
      highScore: 248500,
      cumulativeScore: 410000,
      cumulativeLevels: 42,
      unlockedHeroes: { beta: true, gamma: true },
      totalCurrency: 12500,
      crystalite: 1800,
      ownedRevives: 3,
      ownedFastReloads: 4,
      ownedRapidFires: 2,
      ownedSpeedBoosts: 5,
      bossesDefeated: 3,
      bossDefeatCount: { warden: 2, punisher: 1, overmind: 0 },
      unlockedTier2Upgrades: true,
      upgradeParts: 28,
      displayedStoryLevels: [1],
      hapticsEnabled: false,
    }));
  });
};

test('mobile command deck is usable and visually stable', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 800 });
  await waitForCommandDeck(page);
  await expectRenderedShips(page);

  const dimensions = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    rootHeight: document.getElementById('root')?.getBoundingClientRect().height ?? 0,
  }));
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.rootHeight).toBe(800);

  const smallVisibleButtons = await page.getByRole('button').evaluateAll(buttons => buttons
    .filter(button => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    })
    .filter(button => button.getBoundingClientRect().height < 44)
    .map(button => button.textContent?.trim() || button.getAttribute('aria-label')));
  expect(smallVisibleButtons).toEqual([]);

  await page.screenshot({ path: '/tmp/galaxia-start-mobile.png' });
});

test('desktop command deck remains framed and reduced-motion safe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1100, height: 900 });
  await waitForCommandDeck(page);
  await expectRenderedShips(page);

  const appFrame = page.locator('#root > div > div');
  const box = await appFrame.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(563);
  expect(box!.height).toBe(900);
  expect(await page.locator('html').getAttribute('data-reduced-motion')).toBe('true');

  await page.screenshot({ path: '/tmp/galaxia-start-desktop.png' });
});

test('progression screens keep their controls inside the mobile frame', async ({ page }) => {
  await seedProgression(page);
  await page.setViewportSize({ width: 500, height: 800 });
  await waitForCommandDeck(page);

  await page.getByRole('button', { name: 'Armory' }).click();
  await expect(page.getByRole('heading', { name: 'Armory' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/galaxia-armory-mobile.png' });
  await page.getByRole('button', { name: 'Back to Menu' }).click();

  await page.getByRole('button', { name: 'Hangar' }).click();
  await expect(page.getByRole('heading', { name: 'Hangar Bay' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/galaxia-hangar-mobile.png' });
  await page.getByRole('button', { name: 'Back to Menu' }).click();

  await page.getByRole('button', { name: 'Store' }).click();
  await expect(page.getByRole('heading', { name: 'Store' })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/galaxia-store-mobile.png' });

  const horizontalOverflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(0);
});

test('pause keeps the last gameplay canvas frame visible and frozen', async ({ page }) => {
  await seedProgression(page);
  await page.setViewportSize({ width: 500, height: 800 });
  await waitForCommandDeck(page);
  await page.getByRole('button', { name: 'Launch mission' }).click();
  await page.getByRole('button', { name: 'Pause game' }).click({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();

  const canvasChecksum = () => page.locator('canvas').evaluateAll(canvases => canvases.map(canvas => {
    const element = canvas as HTMLCanvasElement;
    const context = element.getContext('2d');
    if (!context) return 0;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let checksum = 0;
    for (let index = 3; index < pixels.length; index += 64) checksum = (checksum + pixels[index]) % 1_000_000_007;
    return checksum;
  }));

  await page.waitForTimeout(120);
  const frozenFrame = await canvasChecksum();
  await page.waitForTimeout(350);
  expect(await canvasChecksum()).toEqual(frozenFrame);
  expect(frozenFrame.some(value => value > 0)).toBe(true);
  await page.screenshot({ path: '/tmp/galaxia-pause-mobile.png' });
});

import { expect, test, type Page } from '@playwright/test';

async function openBlankWorkbench(page: Page): Promise<void> {
  await page.goto('/zh-CN');

  const welcomeDialog = page.getByRole('dialog', {
    name: '欢迎来到 Synthesizer Flow',
  });
  await expect(welcomeDialog).toBeVisible();
  await welcomeDialog
    .getByRole('button', { name: /新建项目.*从空白画布开始创作/ })
    .click();

  await expect(page.getByTestId('editor-canvas')).toBeVisible();
}

async function openModuleBrowser(page: Page): Promise<void> {
  await page.getByRole('button', { name: '模块浏览器' }).click();
  await expect(page.getByRole('heading', { name: '模块浏览器' })).toBeVisible();
}

test('可以添加模块并撤销、重做画布操作', async ({ page }) => {
  await openBlankWorkbench(page);
  await openModuleBrowser(page);

  await page.getByRole('button', { name: '添加模块：数字输入' }).click();
  await page.getByRole('button', { name: '添加模块：计算器' }).click();

  await expect(page.locator('[data-module-type="numberinput"]')).toHaveCount(1);
  await expect(page.locator('[data-module-type="calculator"]')).toHaveCount(1);

  await page.keyboard.press('Control+z');
  await expect(page.locator('[data-module-type="calculator"]')).toHaveCount(0);
  await expect(page.locator('[data-module-type="numberinput"]')).toHaveCount(1);

  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('[data-module-type="calculator"]')).toHaveCount(1);
});

test('可以从 MIDI Clip 打开底部编辑器', async ({ page }) => {
  await openBlankWorkbench(page);
  await openModuleBrowser(page);

  await page.getByRole('button', { name: '添加模块：MIDI Clip' }).click();
  await expect(page.locator('[data-module-type="sequencer"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Open MIDI editor' }).click();
  await expect(page.getByText('MIDI 编辑器', { exact: true })).toBeVisible();
});

test('模块浏览器可以滚动到列表底部并添加模块', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openBlankWorkbench(page);
  await openModuleBrowser(page);

  const speakerButton = page.getByRole('button', {
    name: '添加模块：扬声器',
  });
  await expect(speakerButton).not.toBeInViewport();

  await speakerButton.scrollIntoViewIfNeeded();
  await expect(speakerButton).toBeInViewport();
  await speakerButton.click();

  await expect(page.locator('[data-module-type="speaker"]')).toHaveCount(1);
});

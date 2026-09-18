import { expect, test } from '@playwright/test'
import path from 'node:path'

const sampleImage = path.resolve('tests/fixtures/pic_001.jpg')

test('데스크톱에서 이미지를 올리고 드론 탐지 결과를 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/')
  await expect(page.getByText('탐지 서버 연결됨')).toBeVisible()

  await page.locator('input[type=file]').setInputFiles(sampleImage)
  await expect(page.getByText('pic_001.jpg')).toBeVisible()
  await page.getByRole('button', { name: /드론 탐지 시작/ }).click()

  await expect(page.getByText('드론 1')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('strong').filter({ hasText: /86\.\d%/ }).first()).toBeVisible()
  await page.screenshot({ path: '/tmp/drone-ui-desktop.png', fullPage: true })
})

for (const viewport of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
]) {
  test(`${viewport.name} 화면에서 레이아웃이 넘치지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /사진 속 드론/ })).toBeVisible()
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)
    await page.screenshot({ path: `/tmp/drone-ui-${viewport.name}.png`, fullPage: true })
  })
}

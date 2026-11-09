import { expect, test } from './fixtures'

test('start page loads without contacting other origins', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Painfold')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Painfold')
})

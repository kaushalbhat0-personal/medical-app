import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadCreds() {
  const p = path.join(__dirname, '.e2e-credentials.json');
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as {
    patientEmail: string;
    patientPassword: string;
    bookingDate?: string;
    doctorDisplayName: string;
  };
}

test.describe('Patient portal', () => {
  test('book an appointment from doctors list', async ({ page }) => {
    const c = loadCreds();
    await page.goto('/login');

    await page.locator('input[type="email"]').fill(c.patientEmail);
    await page.locator('input[type="password"]').first().fill(c.patientPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/patient\/home/, { timeout: 25_000 });

    await page.getByRole('link', { name: 'Doctors', exact: true }).click();
    await expect(page).toHaveURL(/\/patient\/doctors/, { timeout: 15_000 });

    const doctorCard = page
      .locator('div.rounded-xl.border')
      .filter({
        has: page.getByRole('heading', { level: 3, name: c.doctorDisplayName, exact: true }),
      });
    const bookBtn = doctorCard.getByRole('button', { name: 'Book appointment' });
    await expect(bookBtn).toBeEnabled({ timeout: 20_000 });
    await bookBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();

    const bookingDate = c.bookingDate ?? '2035-06-15';
    const slotsResponse = page.waitForResponse(
      (res) => res.url().includes('/slots') && res.status() === 200
    );
    await page.locator('#book-date').fill(bookingDate);
    await slotsResponse;

    const slotLocator = page.locator('[data-testid="slot-button"]');
    const noSlots = page.getByText(/No slots available/i);
    if ((await slotLocator.count()) === 0) {
      await expect(noSlots).toBeVisible({ timeout: 20_000 });
      return;
    }
    await expect(slotLocator.first()).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid="slot-button"]:enabled').first().click();

    await page.getByRole('button', { name: 'Confirm' }).click();

    await expect(page).toHaveURL(/\/patient\/appointments/, { timeout: 25_000 });
  });
});

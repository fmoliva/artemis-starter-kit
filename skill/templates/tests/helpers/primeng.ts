import { Page, Locator } from '@playwright/test';

/**
 * PrimeNG component helpers for Angular + PrimeNG apps.
 *
 * PrimeNG renders complex DOM structures that don't map to standard ARIA roles.
 * These helpers encapsulate the brittle patterns so selector drift is fixed in
 * one place rather than across every spec file.
 */

/**
 * Click a button inside a visible p-dialog, regardless of the actual element type.
 *
 * Why: PrimeNG dialog action buttons are often rendered as <a> links or <div>
 * elements, not <button>. getByRole('button') silently times out for these.
 * This helper looks for the text inside the visible dialog and clicks whatever
 * element carries it — no role assumption.
 */
export async function clickDialogButton(page: Page, buttonText: string): Promise<void> {
  const dialog = page.locator('p-dialog, [role="dialog"]').filter({ hasText: buttonText }).first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });
  const btn = dialog.locator(`text="${buttonText}"`).first();
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
}

/**
 * Select one or more options from a PrimeNG p-multiselect dropdown.
 *
 * Why: p-multiselect has no native <select> — it renders a custom panel with
 * getByRole('option') items that only appear after clicking the trigger label.
 * Clicking the input itself does nothing; you must click the visible label text.
 */
export async function selectFromMultiselect(
  page: Page,
  label: string,
  options: string[],
): Promise<void> {
  await page.getByText(label, { exact: true }).click();
  await page.locator('.p-multiselect-panel').waitFor({ state: 'visible', timeout: 5000 });
  for (const option of options) {
    await page.getByRole('option', { name: option }).click();
  }
  await page.keyboard.press('Escape');
  await page.locator('.p-multiselect-panel').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

/**
 * Fill a 3-level cascading dropdown chain (e.g. country -> state -> city).
 *
 * Why: each select fires an API call that re-renders the next dropdown.
 * Selecting level 2 before level 1's response lands populates the wrong options.
 * waitForResponse catches the network call between each step.
 *
 * TODO: pass the formcontrolname for each level and the URL fragments each
 * level's API call contains.
 */
export async function fillCascadingDropdowns(
  page: Page,
  levels: [
    { control: string; value: string; responseUrlPart: string },
    { control: string; value: string; responseUrlPart: string },
    { control: string; value: string },
  ],
): Promise<void> {
  for (const level of levels) {
    const select = page.locator(`select[formcontrolname="${level.control}"]`);
    if ('responseUrlPart' in level) {
      await Promise.all([
        page.waitForResponse(res => res.url().includes(level.responseUrlPart), { timeout: 10000 }),
        select.selectOption({ label: level.value }),
      ]);
    } else {
      await select.selectOption({ label: level.value });
    }
  }
}

/**
 * Wait for all PrimeNG dialog masks to detach from the DOM.
 *
 * Why: p-dialog-mask elements linger in the DOM after a modal is dismissed,
 * blocking pointer events on content below. Removing or waiting for them to
 * detach prevents "intercepts pointer events" failures in subsequent steps.
 */
export async function waitForPrimeNGMask(page: Page): Promise<void> {
  await page.locator('.p-dialog-mask').waitFor({ state: 'detached', timeout: 5000 }).catch(async () => {
    await page.evaluate(() =>
      document.querySelectorAll('.p-dialog-mask').forEach(el => el.remove()),
    );
  });
}

/**
 * Find a table row where a specific column contains a given value.
 *
 * Why: PrimeNG tables have no row-level ARIA identity. Finding a row by cell
 * value requires scanning the column index, then finding the matching row.
 * Returns the full <tr> locator so callers can interact with any cell or button
 * within that row.
 *
 * @param columnName - The visible column header text (case-sensitive)
 * @param cellValue  - The value to match in that column
 */
export async function getTableRow(
  page: Page,
  columnName: string,
  cellValue: string,
): Promise<Locator> {
  const table = page.locator('table').first();
  const headers = table.locator('thead th');
  const count = await headers.count();
  let colIndex = -1;

  for (let i = 0; i < count; i++) {
    const text = await headers.nth(i).innerText();
    if (text.trim() === columnName) {
      colIndex = i;
      break;
    }
  }

  if (colIndex === -1) {
    throw new Error(`Column "${columnName}" not found in table`);
  }

  const rows = table.locator('tbody tr');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const cell = rows.nth(i).locator('td').nth(colIndex);
    const text = await cell.innerText();
    if (text.trim() === cellValue) {
      return rows.nth(i);
    }
  }

  throw new Error(`Row with ${columnName}="${cellValue}" not found in table`);
}

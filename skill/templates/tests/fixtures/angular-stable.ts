import { test as base, Page } from '@playwright/test';
import { waitForAngularStable } from '../helpers/navigation';

/**
 * Extended test fixture that automatically waits for Angular zone stability
 * after every page load event. This replaces scattered waitForTimeout(3000) calls.
 *
 * Why: page.goto() and client-side route changes resolve on the browser load event,
 * which fires BEFORE Angular bootstraps, runs route guards, and renders components.
 * This fixture hooks into the load event so every test gets the wait for free.
 *
 * Usage: replace
 *   import { test, expect } from '@playwright/test';
 * with:
 *   import { test, expect } from './fixtures/angular-stable';
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    page.on('load', () => {
      waitForAngularStable(page).catch(() => {});
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';

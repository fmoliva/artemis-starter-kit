import { Page } from '@playwright/test';
import path from 'path';

const STORAGE_STATE = path.join(__dirname, '../../playwright/.auth/user.json');

// TODO: set to your app's post-login landing page.
const LANDING_PATH = '/home';
const LANDING_GLOB = '**/home';

/**
 * Wait until Angular zone.js has finished all pending async work
 * (HTTP calls, timers, route guards). Angular exposes this via its
 * testability API: window.getAllAngularTestabilities().
 *
 * Why this is needed: page.goto() resolves on the browser's load event,
 * which fires BEFORE Angular bootstraps and runs route guards. Route guards
 * can redirect the page (e.g. to the landing page) 2–5s after waitForURL resolves.
 * Calling this after goto() ensures Angular has settled before we proceed.
 */
export async function waitForAngularStable(page: Page, timeout = 15000): Promise<void> {
  await page.waitForFunction(
    () => {
      const testabilities = (window as any).getAllAngularTestabilities?.();
      if (!testabilities || testabilities.length === 0) return true;
      return testabilities.every((t: any) => t.isStable());
    },
    { timeout },
  ).catch(() => {
    // Not all pages expose the testability API (e.g. login page).
    // Fall through — the caller's subsequent waitFor will catch real issues.
  });
}

/**
 * Dismiss a location/facility/context-selection dialog.
 *
 * Some Angular apps show a location/facility modal on every fresh session
 * (in-memory Angular service state — not persisted in localStorage). This helper
 * waits for the dialog, clicks the confirm button, and waits for the app to write
 * the selected-location flag to localStorage before returning.
 *
 * Customize:
 *   - dialogHeading: the visible heading text of the dialog
 *   - confirmButton:  the button that commits the selection
 *   - localStorageKey: the key the app writes to localStorage on confirm (or null
 *     if the app does not use localStorage for this)
 *
 * Returns true if the dialog was found and dismissed, false if it never appeared.
 */
export async function handleLocationDialog(
  page: Page,
  options: {
    dialogHeading?: string;
    confirmButton?: string;
    localStorageKey?: string | null;
    timeout?: number;
  } = {},
): Promise<boolean> {
  const {
    dialogHeading = 'Select Location' /* TODO: your dialog's heading */,
    confirmButton = 'Confirm' /* TODO: your confirm button label */,
    localStorageKey = 'location-selected' /* TODO: your app's flag, or null */,
    timeout = 10000,
  } = options;

  const dialog = page.getByRole('heading', { name: dialogHeading });
  const appeared = await dialog
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);

  if (!appeared) return false;

  await page.getByRole('button', { name: confirmButton }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

  if (localStorageKey) {
    await page.waitForFunction(
      (key: string) => localStorage.getItem(key) === 'true',
      localStorageKey,
      { timeout: 6000 },
    ).catch(() => {});
  }
  return true;
}

/**
 * Change the active location/facility using the app's location switcher.
 *
 * This is the user-facing flow: open a launcher or settings dropdown → click
 * "Location" → select location + role → confirm. Saves updated storageState
 * immediately so the post-rotation session cookies are not lost.
 *
 * TODO: customize the selectors below for your app's location switcher UI.
 *
 * @param location - The location/facility name as it appears in the dropdown
 * @param role     - The role name as it appears in the second dropdown (if any)
 */
export async function changeLocationTo(page: Page, location: string, role?: string): Promise<void> {
  // TODO: replace with your app's launcher selector
  await page.locator('[data-testid="app-launcher"]').click();
  await page.getByText('Location', { exact: true }).click();

  // TODO: replace with your dialog heading
  const heading = page.getByRole('heading', { name: 'Select Location' });
  await heading.waitFor({ state: 'visible', timeout: 10000 });

  await page.locator('[role="dialog"] select').first().selectOption({ label: location });

  if (role) {
    await page.waitForTimeout(400);
    await page.locator('[role="dialog"] select').nth(1).selectOption({ label: role });
  }

  await page.getByRole('button', { name: 'Confirm' }).click();

  // TODO: update the post-confirm URL for your app
  await page.waitForURL(LANDING_GLOB, { timeout: 10000 });
  await page.waitForFunction(
    () => localStorage.getItem('location-selected') === 'true',
    { timeout: 8000 },
  ).catch(() => {});

  // Persist rotated session cookies so subsequent test contexts start authenticated.
  await page.context().storageState({ path: STORAGE_STATE });
}

/**
 * Returns a response listener that saves storageState mid-test whenever the
 * app's location-change API responds. Use this when a test changes location at
 * step N and makes authenticated calls at steps N+1…N+k — afterEach saves too
 * late for intra-test stale-cookie failures.
 *
 * The listener fires on any API response whose URL contains the given pattern
 * and has a 2xx status code.
 *
 * Usage:
 *   const stop = attachLocationRotationListener(page);
 *   // ... steps that include a location change ...
 *   stop();
 *
 * TODO: replace the URL pattern with your app's location-change endpoint.
 */
export function attachLocationRotationListener(
  page: Page,
  urlPattern = '/api/user-location' /* TODO: your context-change endpoint */,
): () => void {
  const handler = async (response: any) => {
    if (response.url().includes(urlPattern) && response.status() >= 200 && response.status() < 300) {
      await page.context().storageState({ path: STORAGE_STATE }).catch(() => {});
    }
  };
  page.on('response', handler);
  return () => page.off('response', handler);
}

/**
 * Navigate to a module by clicking its card on the app's landing page.
 *
 * Always enters from the landing page so Angular route
 * guards see a valid navigation context — direct URL navigation is blocked by
 * route guards in most Angular apps.
 *
 * TODO: set LANDING_PATH / LANDING_GLOB and the card selector with your app's equivalents.
 *
 * @param moduleHref - The href attribute of the module card anchor (e.g. '/orders/search')
 */
export async function gotoModule(page: Page, moduleHref: string): Promise<void> {
  await page.goto(LANDING_PATH);
  await handleLocationDialog(page);
  // Remove any PrimeNG dialog masks that block pointer events after the dialog closes.
  await page.evaluate(() =>
    document.querySelectorAll('.p-dialog-mask').forEach((el) => el.remove()),
  );
  await page.locator(`a[href="${moduleHref}"]`).click();
  await page.waitForURL(`**${moduleHref}`, { timeout: 15000 });
  await handleLocationDialog(page, { timeout: 5000 });
}

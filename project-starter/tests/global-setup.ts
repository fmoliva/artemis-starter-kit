import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const STORAGE_STATE = path.join(__dirname, '../playwright/.auth/user.json');

async function globalSetup() {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${process.env.APP_URL}/login`); // TODO: update if your login path differs

  // TODO: update these selectors to match your app's login form
  await page.getByLabel('Username').fill(process.env.APP_USERNAME!);
  await page.getByLabel('Password').fill(process.env.APP_PASSWORD!);
  await page.getByRole('button', { name: 'Login' }).click();

  await page.waitForURL('**'); // TODO: update to your post-login URL pattern (e.g. '**/dashboard')

  await page.context().storageState({ path: STORAGE_STATE });
  await browser.close();
}

export default globalSetup;

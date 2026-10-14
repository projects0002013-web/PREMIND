import { existsSync } from "node:fs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    process.env.PREMIND_BASE_URL || "http://localhost:4173/PREMIND/",
  );
  await page.getByText("Открыть PREMIND").click();
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    return await (await fetch(link.href)).json();
  });
  assert.equal(manifest.start_url, '/PREMIND/');
  assert.equal(manifest.icons.length, 2);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: /Добро пожаловать/ }).waitFor();
  await page.getByRole("link", { name: "Тестирование", exact: true }).click();
  await page.locator(".test-cards .card").first().getByText("Обучение").click();
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  await page.getByRole("button", { name: "Нажмите!", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS production offline reload, navigation and reaction stimulus; no runtime errors",
  );
} finally {
  await browser.close();
}

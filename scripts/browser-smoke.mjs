import { existsSync } from "node:fs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.PREMIND_BASE_URL || "http://localhost:5173/PREMIND/";
try {
  await page.goto(base);
  await page.getByText("Открыть PREMIND").click();
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await page.clock.install();
  async function run(kind, trials) {
    await page.getByRole("button", { name: "Start", exact: true }).click();
    for (let i = 0; i < trials; i++) {
      if (kind === "reaction") {
        await page.clock.runFor(4500);
        await page
          .getByRole("button", { name: "Respond!", exact: true })
          .click();
      } else if (kind === "stroop") {
        await page.clock.runFor(i ? 1300 : 600);
        const color = await page
          .locator(".word")
          .evaluate((el) => el.style.color);
        const idx = [
          "rgb(34, 197, 94)",
          "rgb(59, 130, 246)",
          "rgb(239, 68, 68)",
          "rgb(245, 158, 11)",
        ].indexOf(color);
        assert.ok(idx >= 0);
        await page.locator(".color-options button").nth(idx).click();
      } else if (kind === "search") {
        await page.clock.runFor(i ? 1300 : 600);
        await page.getByRole("button", { name: "Q", exact: true }).click();
      } else if (kind === "memory") {
        await page.clock.runFor(i ? 1300 : 600);
        const digits = await page.locator(".digits").innerText();
        await page.clock.runFor(3400);
        await page.getByLabel("Enter the sequence").fill(digits);
        await page.getByRole("button", { name: "Submit", exact: true }).click();
      } else {
        await page.clock.runFor(i ? 1250 : 600);
        const symbol = await page.locator(".stimulus").innerText();
        assert.ok(symbol === "○" || symbol === "×", symbol);
        if (symbol === "○") await page.locator(".stimulus").click();
        else await page.clock.runFor(1000);
      }
    }
    await page.clock.runFor(700);
  }
  const kinds = ["reaction", "stroop", "attention", "memory", "search"];
  for (let k = 0; k < kinds.length; k++) {
    if (k === 0)
      await page
        .getByRole("link", { name: "Cognitive tests", exact: true })
        .click();
    else await page.getByText("Another test").click();
    await page
      .locator(".test-cards .card")
      .nth(k)
      .getByText("Start test")
      .click();
    await run(
      kinds[k],
      kinds[k] === "reaction" ? 8 : kinds[k] === "attention" ? 24 : 12,
    );
    await page.getByText("MEASUREMENT SAVED").waitFor();
    console.log(`PASS ${kinds[k]} completed and saved`);
  }
  await page.reload();
  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await page.locator("tbody tr").first().waitFor();
  assert.equal(await page.locator("tbody tr").count(), 5);
  console.log("PASS five results persist after reload");
  await page.getByRole("link", { name: "Research Lab", exact: true }).click();
  await page.getByLabel("Time points").fill("2");
  await page.getByLabel("Break, seconds").fill("10");
  await page.getByLabel("Stroop test", { exact: true }).uncheck();
  await page.getByText("Create and start").click();
  await page.getByText(/I consent to local storage/).click();
  await page.getByText("Begin series").click();
  await run("reaction", 8);
  await page.getByText("Save and rest").click();
  assert.ok(await page.getByText("Next series").isDisabled());
  await page.clock.runFor(11000);
  await page.getByText("Next series").click();
  await run("reaction", 8);
  await page.getByText("Complete study").click();
  await page.getByText("Research session finished").waitFor();
  assert.equal(await page.locator(".report tbody tr").count(), 2);
  assert.equal(
    await page.locator("section.card").first().locator("tbody tr").count(),
    3,
  );
  console.log(
    "PASS research series, required break, three self-assessments and report",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(1000);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Back to Research Lab" }).click();
  await page.clock.runFor(1000);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  console.log("PASS mobile layout");
  assert.deepEqual(errors, []);
  console.log("PASS no runtime errors");
} finally {
  await browser.close();
}

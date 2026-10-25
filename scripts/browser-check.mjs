import { chromium as playwright } from "@playwright/test";
import chromium from "@sparticuz/chromium";
import assert from "node:assert/strict";
const browser = await playwright.launch({
  executablePath: await chromium.executablePath(),
  args: chromium.args,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
const translationRequests = [];
page.on("request", (r) => {
  if (r.url().includes("/api/")) translationRequests.push(r.url());
});
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173");
await page
  .getByRole("heading", { name: "Your hands. Your language." })
  .waitFor();
assert.equal(
  await page.locator("video").evaluate((v) => v.srcObject),
  null,
  "No camera on load",
);
// Translation is a separate opt-in and never produces example model output.
assert.equal(
  await page.getByRole("button", { name: "Connect translation" }).isDisabled(),
  true,
);
await page.getByText("No translation predicted.", { exact: true }).waitFor();
const transcript = page.getByRole("textbox", { name: "EDITABLE TRANSCRIPT" });
assert.equal(await transcript.inputValue(), "");
await transcript.fill("Manually edited text for the UI test.");
await page.getByRole("button", { name: "Clear text", exact: true }).click();
assert.equal(await transcript.inputValue(), "");
await page.getByRole("checkbox", { name: /I agree to send hand/ }).check();
assert.equal(
  await page.getByRole("button", { name: "Connect translation" }).isDisabled(),
  true,
  "Camera must also be active",
);
await page.getByRole("checkbox", { name: /I agree to send hand/ }).uncheck();
assert.equal(
  translationRequests.length,
  0,
  "No landmark sharing or API connection without an explicit Connect action",
);
if (process.env.TEST_TRANSLATION_API === "1") {
  const info = await page.evaluate(async () => {
    const r = await fetch("/api/model-info");
    return r.json();
  });
  assert.equal(info.ready, false);
  assert.equal(info.schema_version, "isl-landmarks-v1");
}
await page.getByRole("button", { name: "Details for Peace sign" }).click();
await page
  .getByRole("dialog")
  .getByRole("heading", { name: "Peace sign", exact: true })
  .waitFor();
await page.getByRole("button", { name: "Close details" }).click();
await page.getByRole("textbox", { name: "Search gestures" }).fill("approval");
assert.equal(await page.locator(".gesture-card").count(), 2);
await page.getByRole("textbox", { name: "Search gestures" }).fill("nonsense");
await page.getByText("No gestures found.").waitFor();
await page.getByRole("textbox", { name: "Search gestures" }).fill("");
await page.getByRole("button", { name: "Mirror preview" }).click();
assert.equal(
  await page
    .getByRole("button", { name: "Mirror preview" })
    .getAttribute("aria-pressed"),
  "false",
);
await page.getByRole("button", { name: "Show landmarks" }).click();
await page.getByRole("button", { name: "Sound feedback" }).click();
await page.getByRole("button", { name: "Expand camera" }).click();
await page.getByRole("button", { name: "Exit expanded camera" }).click();
await page.screenshot({ path: "/tmp/gesture-desktop.png", fullPage: true });
await page.getByRole("button", { name: "Enable camera" }).click();
await page
  .getByRole("button", { name: "Try again", exact: true })
  .waitFor({ timeout: 35000 });
await page
  .getByText(/No camera found|permission was denied|camera is unavailable/)
  .waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "/tmp/gesture-mobile.png", fullPage: true });
assert.equal(
  await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  ),
  false,
  "No mobile horizontal overflow",
);
assert.deepEqual(errors, []);
console.log(
  "PASS: camera opt-in, permission failure, library search/details, toggles, expansion, desktop/mobile layout, translation opt-in/editable transcript, no browser exceptions.",
);
await browser.close();

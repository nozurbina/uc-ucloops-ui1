import { test, expect, stubApi } from "./fixtures.js";

const EMAIL = "ucloops@urbinaconsulting.com";

// A bare mailto silently does nothing on a machine with no default mail client,
// which is most people using webmail. These assert the address is still reachable.

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await stubApi(page);
});

test("the training contact still carries a real mailto", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome to the ucLoops demo app")).toBeVisible();

  const link = page.locator('a[href^="mailto:"]').first();
  // Subject is set, and the address survives encoding.
  await expect(link).toHaveAttribute("href", /^mailto:ucloops@urbinaconsulting\.com\?subject=/);
});

test("clicking the training contact copies the address and says so", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome to the ucLoops demo app")).toBeVisible();

  const link = page.locator('a[href^="mailto:"]').first();
  await expect(link).toHaveText(EMAIL);
  await link.click();

  await expect(link).toHaveText("Address copied ✓");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);

  // The confirmation is temporary — the address comes back so it stays readable.
  await expect(link).toHaveText(EMAIL, { timeout: 5000 });
});

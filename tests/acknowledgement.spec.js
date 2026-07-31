import { test, expect, stubApi, ACK_STORAGE_KEY } from "./fixtures.js";

// The consent screen has to come before anything leaves the browser, so these
// assert on request traffic as well as on what's rendered.

test("a first-time visitor is asked to acknowledge before anything is sent", async ({ page }) => {
  const chatCalls = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/chat")) chatCalls.push(r.url());
  });

  await stubApi(page, { ack: false });
  await page.goto("/?agent=omar");

  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  // The priming turn sends a whole system prompt, so it must not have fired.
  expect(chatCalls).toHaveLength(0);
  // And the app itself is not reachable behind it.
  await expect(page.getByTestId("transcript")).toBeHidden();
});

test("the notice states what is actually true of this app", async ({ page }) => {
  await stubApi(page, { ack: false });
  await page.goto("/");

  const notice = page.locator("form").filter({ hasText: "Before you start" });
  // All content goes to Anthropic, not a sample of it.
  await expect(notice).toContainText("all of it, not a sample");
  // The trade for the demo being free: submissions are kept and read.
  await expect(notice).toContainText("keeps a copy of what I submit");
  await expect(notice).toContainText("read and analyse it");
  // The retention window the sweep and the Redis TTL actually implement.
  await expect(notice).toContainText("up to 30 days");
  await expect(notice).toContainText("Anthropic");
  await expect(notice).toContainText("Urbina Consulting assumes no liability");
});

test("the notice offers a private demo for anyone who can't accept retention", async ({ page }) => {
  await stubApi(page, { ack: false });
  await page.goto("/");

  // The alternative has to be reachable from the gate itself — someone who
  // can't agree to retention needs a way out that isn't "give up".
  const optOut = page.getByRole("link", { name: "I can ask for a private one" });
  await expect(optOut).toHaveAttribute(
    "href",
    /^mailto:ucloops@urbinaconsulting\.com\?subject=/,
  );
});

test("accepting is required, not just offered", async ({ page }) => {
  await stubApi(page, { ack: false });
  await page.goto("/");

  const start = page.getByRole("button", { name: "Start the demo" });
  await expect(start).toBeDisabled();

  await page.getByRole("checkbox").check();
  await expect(start).toBeEnabled();
});

test("accepting lets the demo start and is remembered", async ({ page }) => {
  await stubApi(page, { ack: false });
  await page.goto("/?agent=omar");

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start the demo" }).click();

  // The app comes up and the priming turn now runs.
  await expect(page.getByText("Hello, I'm Omar.")).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), ACK_STORAGE_KEY)).toBe("1");

  // Second visit goes straight in — no flash of the notice.
  await page.reload();
  await expect(page.getByText("Hello, I'm Omar.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeHidden();
});

test("a returning visitor never sees it", async ({ page }) => {
  await stubApi(page); // ack defaults to true
  await page.goto("/?agent=omar");
  await expect(page.getByTestId("transcript")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeHidden();
});

import {
  test,
  expect,
  stubApi,
  scrollState,
  scrollPill,
  transcript,
  SHORT_GREETING,
  REPLY,
} from "./fixtures.js";

// Regression cover for the reported bug: opening a persona used to jump the
// transcript to the bottom, which on a phone put the reader mid-greeting with the
// opening line already scrolled off.
//
// Scroll position is read through expect.poll rather than a bare expect. A plain
// numeric assertion doesn't retry, so it races the effect that does the scrolling
// and the ResizeObserver that re-measures after markdown reflows — which showed up
// as a flake under parallel load.

const AT_BOTTOM = 24; // the same tolerance the component uses

const pinnedToTop = (page) =>
  expect.poll(async () => (await scrollState(page)).scrollTop).toBe(0);

const atBottom = (page) =>
  expect.poll(async () => (await scrollState(page)).fromBottom).toBeLessThanOrEqual(AT_BOTTOM);

// Stubbed per test rather than in beforeEach: one test needs a *short* greeting,
// and layering a second route handler over the first makes precedence the thing
// under test instead of the scrolling.

test("a persona greeting opens pinned to the top", async ({ page }) => {
  await stubApi(page);
  await page.goto("/?agent=omar");
  await expect(page.getByText("Hello, I'm Omar.")).toBeVisible();

  await pinnedToTop(page);
  expect((await scrollState(page)).overflowing).toBe(true);

  // The first line of the greeting must actually be on screen, which is the
  // point of the fix — scrollTop alone could be satisfied by an empty transcript.
  await expect(page.getByText("Hello, I'm Omar.")).toBeInViewport();
});

test("a long greeting offers a way down, and taking it hides the offer", async ({ page }) => {
  await stubApi(page);
  await page.goto("/?agent=omar");
  await expect(scrollPill(page)).toBeVisible();

  await scrollPill(page).click();

  // Smooth scrolling, so wait for the offer to retract rather than asserting the
  // position immediately.
  await expect(scrollPill(page)).toBeHidden();
  await atBottom(page);
});

test("a greeting that fits offers nothing", async ({ page, isMobile }) => {
  // Desktop only, and not because of a layout quirk: below the greeting sit eight
  // conversation starters, which on their own are taller than a phone viewport. So
  // a phone transcript always has more below it and the affordance is always
  // correct there. The "content fits" branch is only reachable on a big screen.
  test.skip(isMobile, "a phone transcript always overflows: the starters alone exceed it");

  await stubApi(page, { greeting: SHORT_GREETING });
  await page.goto("/?agent=omar");
  await expect(page.getByText(SHORT_GREETING)).toBeVisible();

  expect((await scrollState(page)).overflowing).toBe(false);
  await expect(scrollPill(page)).toBeHidden();
});

test("sending follows to the bottom even from the pinned top", async ({ page }) => {
  await stubApi(page);
  await page.goto("/?agent=omar");
  await expect(page.getByText("Hello, I'm Omar.")).toBeVisible();
  await pinnedToTop(page);

  const question = "What makes lunch work for you?";
  await page.getByRole("textbox").first().fill(question);
  await page.getByRole("button", { name: "Send" }).click();

  // You must end up seeing the exchange you just started, or sending looks like a
  // no-op from the pinned-top position.
  await expect(page.getByText(REPLY)).toBeVisible();
  await atBottom(page);
  await expect(page.getByText(REPLY)).toBeInViewport();
});

test("scrolling up to re-read is not yanked back down by a reply", async ({ page }) => {
  await stubApi(page);
  await page.goto("/?agent=omar");
  await expect(page.getByText("Hello, I'm Omar.")).toBeVisible();

  // Get into a conversation first, so we're in the "following" regime.
  await page.getByRole("textbox").first().fill("first question");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(REPLY).first()).toBeVisible();

  // Now deliberately scroll away from the bottom and ask again.
  await transcript(page).evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.getByRole("textbox").first().fill("second question");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("second question")).toBeVisible();

  // Sending is an explicit act, so this one SHOULD follow — the no-yank rule
  // applies to replies arriving unprompted, not to your own messages.
  await atBottom(page);
});

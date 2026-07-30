import { test, expect, stubApi } from "./fixtures.js";

const COURSES_URL = "https://urbinaconsulting.com/shares/ucloops/cohort-journeys-sept-2026/";

test.beforeEach(async ({ page }) => {
  await stubApi(page);
});

test("the disabled-skills callout keeps its label on one line", async ({ page }) => {
  await page.goto("/");
  const label = page.getByText("Disabled skills", { exact: true });
  await expect(label).toBeVisible();

  // The bug was the label collapsing into a three-line stack, because it sat in a
  // column sized for a single glyph. One line is the whole assertion.
  const lines = await label.evaluate((el) => {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    return Math.round(el.getBoundingClientRect().height / lineHeight);
  });
  expect(lines).toBe(1);
});

test("the training CTA sits at the end of the overview", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Contact us for training" });
  await expect(cta).toHaveAttribute("href", COURSES_URL);
  await expect(
    page.getByText("Want to learn to create personas like these in your own tools?"),
  ).toBeVisible();

  // "At the bottom" is the requirement, so assert ordering rather than presence:
  // it must come after the cross-cutting skills section.
  const ctaTop = await cta.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const crossCutting = page.getByText("Available to every agent", { exact: false }).first();
  if (await crossCutting.count()) {
    const ccTop = await crossCutting.evaluate(
      (el) => el.getBoundingClientRect().top + window.scrollY,
    );
    expect(ctaTop).toBeGreaterThan(ccTop);
  }
});

test("the courses card follows the assistants in the sidebar", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: /Open to chat with agents/ }).click();

  const card = page.getByRole("link", { name: "Learn more" });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute("href", COURSES_URL);

  // Below the last assistant, not above it.
  const dataAssistant = page.getByRole("button", { name: /Data Assistant/ }).first();
  const assistantBottom = await dataAssistant.evaluate((el) => el.getBoundingClientRect().bottom);
  const cardTop = await card.evaluate((el) => el.getBoundingClientRect().top);
  expect(cardTop).toBeGreaterThan(assistantBottom);
});

test("both course links point at the same place", async ({ page }) => {
  await page.goto("/");
  // goto resolves on load, before React has rendered. A count assertion doesn't
  // auto-wait the way toBeVisible does, so wait for the tree explicitly first.
  await expect(page.getByText("Welcome to the ucLoops demo app")).toBeVisible();

  // The sidebar card and the overview CTA. Sharing one constant is the point.
  await expect(page.locator(`a[href="${COURSES_URL}"]`)).toHaveCount(2);
});

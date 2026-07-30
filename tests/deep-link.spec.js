import { test, expect, stubApi } from "./fixtures.js";

// The BorderBlend evidence-map site links in with ?agent=<id>, and those ids are
// lowercase and case-sensitive. A mis-cased id silently lands on the overview, so
// this pins the contract that site depends on.

test.beforeEach(async ({ page }) => {
  await stubApi(page);
});

const PERSONAS = [
  ["omar", "Omar"],
  ["grace", "Grace"],
  ["mateo", "Mateo"],
  ["diego", "Diego"],
  ["tyler", "Tyler"],
];

for (const [id, name] of PERSONAS) {
  test(`?agent=${id} opens that persona`, async ({ page }) => {
    await page.goto(`/?agent=${id}`);
    await expect(page.getByTestId("active-agent")).toHaveText(name);
  });
}

test("the assistants are reachable by the same mechanism", async ({ page }) => {
  await page.goto("/?agent=ux");
  await expect(page.getByTestId("active-agent")).toHaveText("UX Assistant");
});

test("a mis-cased id does not open a persona", async ({ page }) => {
  // Documents current behaviour rather than blessing it: the id is validated
  // against the registry, fails, and the app falls back to the overview.
  await page.goto("/?agent=Omar");
  await expect(page.getByText("Welcome to the ucLoops demo app")).toBeVisible();
});

test("an unknown id does not open a persona", async ({ page }) => {
  await page.goto("/?agent=nobody");
  await expect(page.getByText("Welcome to the ucLoops demo app")).toBeVisible();
});

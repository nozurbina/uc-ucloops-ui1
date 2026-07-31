import { test as base, expect } from "@playwright/test";

// Long enough to overflow any viewport we test, so the "more below" affordance is
// genuinely exercised. Mirrors the real greeting's shape: opening line, the
// methodology boilerplate, then an "About me".
export const LONG_GREETING = [
  "Hello, I'm Omar.",
  "",
  "I am a ucLoops Persona Simulation created for the purposes of designing strategies, content, and user experiences.",
  "",
  "You can chat with me generally, or use the command /help to know what skills I have available.",
  "",
  "## About me",
  "",
  ...Array.from(
    { length: 12 },
    (_, i) =>
      `Paragraph ${i + 1}: lunch is a problem I solved years ago and I refuse to re-solve it daily. ` +
      "I optimise for minutes, not money, and I will take reliability over novelty every time.",
  ).flatMap((p) => [p, ""]),
].join("\n");

export const SHORT_GREETING = "Hello, I'm Omar. Ask me about weekday lunch.";

export const REPLY = "Six minutes, genuinely good brisket, and knowing the truck is there.";

/**
 * Stubs every API route the app touches.
 *
 * `greeting` controls the priming turn, which is what the scroll behaviour keys
 * off — pass SHORT_GREETING to assert the affordance stays hidden when the
 * transcript fits.
 */
export const ACK_STORAGE_KEY = "ucLoopsAckV1";

/**
 * Pre-accept the demo terms. Uses addInitScript so the key is in place before the
 * app's first render, which reads it synchronously — setting it after goto would be
 * too late and the gate would still show.
 */
export async function acceptTerms(page) {
  await page.addInitScript(
    (key) => window.localStorage.setItem(key, "1"),
    ACK_STORAGE_KEY,
  );
}

export async function stubApi(page, { greeting = LONG_GREETING, turnsMax = 15, ack = true } = {}) {
  // Most tests are about something behind the consent screen, so accept by default
  // and let the acknowledgement specs opt out.
  if (ack) await acceptTerms(page);

  // The gate is a deployment concern, not something these tests exercise.
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ gateEnabled: false, unlocked: true, capsEnforced: false }),
    }),
  );

  let turnsUsed = 0;
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON();
    // The priming turn is app-triggered and deliberately doesn't spend a turn,
    // so the stub has to model that or the counter assertions drift.
    const isInit = Boolean(body.init);
    if (!isInit) turnsUsed += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: isInit ? greeting : REPLY,
        token: "test-token",
        turnsUsed,
        turnsMax,
        limitReached: turnsUsed >= turnsMax,
      }),
    });
  });
}

export const transcript = (page) => page.getByTestId("transcript");
export const scrollPill = (page) => page.getByTestId("scroll-for-more");

/** Where the transcript sits: 0 is pinned to top, 0 from bottom is fully scrolled. */
export function scrollState(page) {
  return transcript(page).evaluate((el) => ({
    scrollTop: Math.round(el.scrollTop),
    fromBottom: Math.round(el.scrollHeight - el.clientHeight - el.scrollTop),
    overflowing: el.scrollHeight > el.clientHeight + 2,
  }));
}

export const test = base;
export { expect };

import { expect, test, type Page } from "@playwright/test";
import { RUN_IDS, seed, type ActiveState } from "./seed";

/**
 * Criterion 6 of H7: in every state that waits for the human, at 1280 and
 * 390 px, no horizontal scroll and the human's actions in view (D42–D48).
 * Nothing is submitted: the actions would run effects against GitHub.
 */

const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

async function noHorizontalScroll(page: Page) {
  const [scroll, width] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(scroll, "scroll horizontal").toBeLessThanOrEqual(width);
}

/** No card overflows its column (the timeline did on desktop in H7). */
async function noOverflow(page: Page, testId: string) {
  const [scroll, width] = await page
    .getByTestId(testId)
    .evaluate((el) => [el.scrollWidth, el.clientWidth]);
  expect(scroll, `desborde de ${testId}`).toBeLessThanOrEqual(width);
}

async function openRun(page: Page, state: ActiveState, query = "") {
  const id = await seed(state);
  await page.goto(`/runs/${id}${query}`);
  await expect(page.getByTestId("agent-cards")).toBeVisible();
  return id;
}

/** The human's card is the active one (D42). */
async function humanTurn(page: Page, label: RegExp) {
  const human = page.locator('[data-testid="agent-card"][data-agent="human"]');
  await expect(human).toHaveAttribute("data-active", "true");
  await expect(human.getByTestId("agent-card-label")).toHaveText(label);
  await expect(page.getByTestId("agent-card")).toHaveCount(4);
}

const WAITING: {
  state: ActiveState;
  card: RegExp;
  buttons: string[];
}[] = [
  {
    state: "awaiting_plan_approval",
    card: /Aprobar el plan/,
    buttons: ["approve-button", "reject-open"],
  },
  {
    state: "awaiting_final_approval",
    card: /Aprobar la vista previa final/,
    buttons: ["approve-button", "reject-open"],
  },
  {
    state: "blocked",
    card: /Decidir sobre la tarea 2/,
    buttons: ["retry-button", "abandon-button"],
  },
];

test.describe("states that wait for the human (D46)", () => {
  for (const { state, card, buttons } of WAITING) {
    test(`${state}: actions in view, no horizontal scroll`, async ({
      page,
    }) => {
      await openRun(page, state);
      await humanTurn(page, card);
      for (const id of buttons) {
        // On mobile the bar is fixed at the bottom: in view without scrolling.
        await expect(page.getByTestId(id)).toBeInViewport();
      }
      if (mobile(page)) {
        await expect(page.getByTestId("run-actions")).toHaveCSS(
          "position",
          "fixed",
        );
      }
      await noHorizontalScroll(page);
    });
  }

  test("reject opens the feedback field without sending", async ({ page }) => {
    await openRun(page, "awaiting_plan_approval");
    await expect(page.getByTestId("feedback-input")).toHaveCount(0);
    await page.getByTestId("reject-open").click();
    await expect(page.getByTestId("feedback-input")).toBeVisible();
    await expect(page.getByTestId("reject-button")).toBeVisible();
    await noHorizontalScroll(page);
  });
});

test.describe("final approval (D43, D45)", () => {
  test("preview, criteria in both sizes and regression", async ({ page }) => {
    await openRun(page, "awaiting_final_approval");
    const preview = page.getByTestId("preview-panel");
    await expect(preview).toBeVisible();
    await expect(page.getByTestId("open-preview")).toHaveAttribute(
      "target",
      "_blank",
    );
    await expect(preview.getByTestId("preview-criteria")).toContainText(
      "2 de 2 en verde",
    );
    if (mobile(page)) {
      // The preview tab opens first; the tasks are one tap away (D46).
      await expect(page.getByTestId("run-tasks-section")).toBeHidden();
      await page.locator('[data-testid="run-tab"][data-tab="tareas"]').click();
      await expect(page).toHaveURL(/tab=tareas/);
      await expect(preview).toBeHidden();
    }
    const tasks = page.getByTestId("run-tasks-section");
    await expect(tasks).toBeVisible();
    const results = tasks.getByTestId("criterion-result");
    await expect(results).toHaveCount(4);
    for (const r of await results.all()) {
      await expect(r).toHaveAttribute("data-outcome", "pass");
    }
    await expect(tasks.locator("[data-outside]")).toHaveText(
      /client-types\.ts/,
    );
    const regression = page.getByTestId("regression");
    await expect(regression).toContainText("Regresión: 1 de 1 en verde");
    await expect(regression).toHaveAttribute("data-failing", "false");
    await noHorizontalScroll(page);
  });

  test("desktop: two columns; mobile: tabs", async ({ page }) => {
    await openRun(page, "awaiting_final_approval");
    const tabs = page.getByTestId("run-tab");
    const timeline = page.getByTestId("run-timeline");
    if (mobile(page)) {
      await expect(tabs.first()).toBeVisible();
      await expect(timeline).toBeHidden();
      await page.locator('[data-testid="run-tab"][data-tab="linea"]').click();
      await expect(timeline).toBeVisible();
      await expect(page.getByTestId("preview-panel")).toBeHidden();
    } else {
      await expect(tabs.first()).toBeHidden();
      const tasks = await page.getByTestId("run-tasks-section").boundingBox();
      const side = await timeline.boundingBox();
      expect(side!.x).toBeGreaterThan(tasks!.x + tasks!.width - 1);
    }
  });
});

test.describe("timeline (D44)", () => {
  test("filter by agent in the URL, retries grouped", async ({ page }) => {
    await openRun(page, "awaiting_final_approval", "?tab=linea");
    const timeline = page.getByTestId("run-timeline");
    await noOverflow(page, "run-timeline");
    const retries = timeline.getByTestId("timeline-retries");
    await expect(retries).toHaveCount(1);
    await expect(retries).toHaveAttribute("data-count", "3");
    await expect(timeline.getByTestId("timeline-round")).toHaveCount(2);

    await timeline
      .locator('[data-testid="timeline-filter"][data-filter="develop"]')
      .click();
    await expect(page).toHaveURL(/agente=develop/);
    await expect(retries).toHaveCount(0);
    const kinds = await timeline
      .getByTestId("run-event")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-kind")));
    expect(new Set(kinds)).toEqual(
      new Set(["context", "commit", "pushed", "check_passed"]),
    );
    if (mobile(page)) {
      // The tab stays when filtering.
      await expect(page).toHaveURL(/tab=linea/);
    }
    await noHorizontalScroll(page);
  });
});

test.describe("/runs home (D48)", () => {
  test("suggestions, limits and queue", async ({ page }) => {
    await seed("blocked");
    await page.goto("/runs");
    await expect(page.getByTestId("intro")).toBeVisible();
    const suggestions = page.getByTestId("suggestion");
    await expect(suggestions.first()).toHaveAttribute("data-merged", "true");
    await expect(suggestions.first()).toContainText("ya fusionada");

    await expect(suggestions.last()).toHaveAttribute(
      "data-out-of-scope",
      "true",
    );
    await expect(suggestions.last()).toContainText("Fuera de alcance");

    const input = page.getByTestId("request-input");
    await suggestions.nth(1).click();
    await expect(input).toHaveValue(/ciudad del cliente/);
    // It fills the field; nothing is sent.
    await expect(page).toHaveURL(/\/runs$/);

    await expect(page.getByTestId("runs-left")).toHaveText(
      "Quedan 3 de 5 runs hoy",
    );
    await expect(page.getByTestId("advanced-options")).not.toHaveAttribute(
      "open",
    );
    const queued = page.getByTestId("queued-runs");
    await expect(
      queued.locator(`[data-run="${RUN_IDS.queued[0]}"]`),
    ).toContainText("1.º en la cola");
    await expect(
      queued.locator(`[data-run="${RUN_IDS.queued[1]}"]`),
    ).toContainText("2.º en la cola");
    await noHorizontalScroll(page);
  });
});

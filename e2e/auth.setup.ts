import { expect, test as setup } from "@playwright/test";
import { E2E_PASSWORD, E2E_USER } from "./env";

/** Logs in once (D19) and keeps the session cookie for every project. */
setup("login", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("field-user").fill(E2E_USER);
  await page.getByTestId("field-password").fill(E2E_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/runs$/);
  await page.context().storageState({ path: "e2e/.auth/state.json" });
});

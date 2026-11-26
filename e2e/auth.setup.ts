import { expect, test as setup } from "@playwright/test";
import { E2E_PASSWORD, E2E_USER } from "./env";

/** Logs in once (D19) and keeps the session cookie for every project. */
setup("login", async ({ page }) => {
  // Wait for hydration: a field filled before it is emptied by React.
  await page.goto("/login", { waitUntil: "networkidle" });
  const user = page.getByTestId("field-user");
  const password = page.getByTestId("field-password");
  await expect(async () => {
    await user.fill(E2E_USER);
    await password.fill(E2E_PASSWORD);
    await expect(user).toHaveValue(E2E_USER, { timeout: 500 });
    await expect(password).toHaveValue(E2E_PASSWORD, { timeout: 500 });
  }).toPass();
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/runs$/);
  await page.context().storageState({ path: "e2e/.auth/state.json" });
});

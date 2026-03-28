import { test, expect } from "@playwright/test";

test("home page loads with main heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText(/Numberblocks Finder/i);
  await expect(page.getByText(/Made with .* for little number fans/i)).toBeVisible();
});

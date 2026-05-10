import { expect, test } from "@playwright/test";

test("plays a full guess flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Guess The Party RO" })).toBeVisible();
  await expect(page.getByText(/\d+ candidates loaded/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Guvern" }).click();
  await expect(page.getByText(/\d+ government members loaded/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByAltText("Romanian politician portrait")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "PSD" }).click();
  await expect(page.getByText(/0 \/ 1|1 \/ 1/)).toBeVisible();
  await expect(page.getByText(/Correct|Wrong/)).toBeVisible();
  await expect(page.getByText(/· you guessed PSD/)).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Recent guesses" })).toBeVisible();
});

test("stats page renders aggregate sections", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.locator("h2", { hasText: "Stats" })).toBeVisible();
  await expect(page.getByText("Votes")).toBeVisible();
  await expect(page.getByText("Overall accuracy by party")).toBeVisible();
  await expect(page.getByText("How voters read each party")).toBeVisible();
});

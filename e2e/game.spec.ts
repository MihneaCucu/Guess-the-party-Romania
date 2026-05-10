import { expect, test } from "@playwright/test";

test("plays a full guess flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Guess The Party RO" })).toBeVisible();
  await expect(page.getByRole("button", { name: "All" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Senate" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chamber" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Government" })).toBeVisible();
  await expect(page.getByText(/\d+ candidates loaded/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Government" }).click();
  await expect(page.getByText(/\d+ government members loaded/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByAltText("Romanian politician portrait")).toBeVisible({ timeout: 15000 });
  await page.getByRole("group", { name: "Party choices" }).getByRole("button").first().click();
  await expect(page.getByText(/0 \/ 1|1 \/ 1/)).toBeVisible();
  await expect(page.getByText(/Correct|Wrong/)).toBeVisible();
  await expect(page.getByText(/· you guessed/)).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Recent guesses" })).toBeVisible();
});

test("starts the daily challenge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Daily" }).click();
  await expect(page.getByRole("button", { name: "Reset" })).toBeDisabled();
  await expect(page.getByTestId("daily-progress-label")).toHaveText(/Daily challenge · 0 \/ 10/, { timeout: 15000 });
  await expect(page.getByAltText("Romanian politician portrait")).toBeVisible({ timeout: 15000 });
  await page.getByRole("group", { name: "Party choices" }).getByRole("button").first().click();
  await expect(page.getByText(/Correct|Wrong/)).toBeVisible({ timeout: 15000 });
});

test("keeps daily progress after leaving and returning", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Daily" }).click();
  await expect(page.getByTestId("daily-progress-label")).toHaveText(/Daily challenge · 0 \/ 10/, { timeout: 15000 });
  await expect(page.getByAltText("Romanian politician portrait")).toBeVisible({ timeout: 15000 });
  await page.getByRole("group", { name: "Party choices" }).getByRole("button").first().click();
  await expect(page.getByText(/· you guessed/)).toHaveCount(2);
  await page.getByRole("button", { name: "Practice" }).click();
  await expect(page.getByText(/\d+ candidates loaded/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Daily" }).click();
  await expect(page.getByTestId("daily-progress-label")).toHaveText(/Daily challenge · 1 \/ 10/, { timeout: 15000 });
  await expect(page.locator("header").getByText(/0 \/ 1|1 \/ 1/)).toBeVisible();
});

test("shows a completed daily summary instead of a blank question", async ({ page, request }) => {
  const response = await request.get("/api/challenge/daily");
  const daily = (await response.json()) as { date: string; length: number };
  await page.addInitScript(({ date, length }) => {
    window.localStorage.setItem(
      "gtp-ro-daily-progress",
      JSON.stringify({
        date,
        index: length,
        correct: 7,
        total: length,
        streak: 2,
        complete: true,
        recent: []
      })
    );
  }, daily);

  await page.goto("/");
  await page.getByRole("button", { name: "Daily" }).click();
  await expect(page.getByRole("heading", { name: "Daily complete" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("daily-summary-score")).toHaveText(`7 / ${daily.length}`);
  await expect(page.getByRole("button", { name: "Share result" })).toBeVisible();
  await expect(page.getByAltText("Romanian politician portrait")).toHaveCount(0);
});

test("stats page renders aggregate sections", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.locator("h2", { hasText: "Stats" })).toBeVisible();
  await expect(page.getByText("Votes")).toBeVisible();
  await expect(page.getByText("Overall accuracy by party")).toBeVisible();
  await expect(page.getByText("How voters read each party")).toBeVisible();
});

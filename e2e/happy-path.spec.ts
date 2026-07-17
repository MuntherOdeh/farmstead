import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The SPEC §3 happy path: login → import the deliberately messy sample →
// auto-generated dashboard renders.

function adminPassword(): string {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  // `vercel env pull` rewrites .env.local with quoted values — strip them.
  const match = env.match(/^ADMIN_PASSWORD="?([^"\r\n]+)"?$/m);
  if (!match) throw new Error("ADMIN_PASSWORD missing from .env.local");
  return match[1].trim();
}

test("login → import messy sample → dashboard renders", async ({ page }) => {
  // ── Login ──
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill(adminPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Recent transactions")).toBeVisible({ timeout: 20_000 });

  // ── Upload the messy sample ──
  await page.goto("/import");
  await page.waitForLoadState("networkidle");
  // The change handler attaches on hydration — retry the file drop until the
  // sheet picker responds so a lost pre-hydration event can't hang the test.
  const samplePath = join(process.cwd(), "public", "samples", "farmstead-sample-messy.xlsx");
  const sheetButton = page.getByRole("button", { name: "H1 Sales" });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator("input[type=file]").setInputFiles(samplePath);
    try {
      await sheetButton.waitFor({ state: "visible", timeout: 15_000 });
      break;
    } catch {
      // change event lost pre-hydration — drop the file again
    }
  }
  await expect(sheetButton).toBeVisible();

  // Multiple sheets → the picker appeared; choose the English one.
  await sheetButton.click();

  // ── Review: columns detected, quality panel shows the planted anomalies ──
  await expect(page.getByText("Column mapping")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Data quality")).toBeVisible();
  await expect(page.getByText("Qty×price ≠ total")).toBeVisible();

  await page.getByRole("button", { name: "Continue to matching" }).click();
  await expect(page.getByText("Match products")).toBeVisible({ timeout: 30_000 });

  // ── Commit ──
  await page.getByRole("button", { name: /Import \d+ rows/ }).click();
  await expect(page.getByText(/Imported \d+ transactions/)).toBeVisible({ timeout: 60_000 });

  // ── Auto dashboard ──
  await page.getByRole("link", { name: "Open the dashboard" }).click();
  await expect(page.getByText("Data explorer")).toBeVisible({ timeout: 30_000 });
  // At least a few real charts made it to the screen.
  await expect
    .poll(async () => page.locator("[data-slot=card] svg").count(), { timeout: 15_000 })
    .toBeGreaterThan(2);

  // ── Rollback so the e2e run leaves nothing behind ──
  await page.goto("/import");
  await page
    .getByRole("row", { name: /farmstead-sample-messy/ })
    .first()
    .getByRole("button", { name: "Rollback" })
    .click();
  await expect(page.getByText(/Rolled back/)).toBeVisible({ timeout: 20_000 });
});

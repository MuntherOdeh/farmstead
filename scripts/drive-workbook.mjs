// Dev verification: drive the one-click farm-workbook import with a real file
// against a local server. Usage: node scripts/drive-workbook.mjs <file.xlsx>
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const file = process.argv[2] ?? "file/Trial 3.xlsx";
const env = readFileSync(".env.local", "utf8");
const password = env.match(/ADMIN_PASSWORD="?([^"\r\n]+)"?/)[1].trim();

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto("http://localhost:3000/login");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Recent transactions").or(page.getByText("The farm is empty")).first().waitFor({ timeout: 30000 });
  console.log("✓ logged in");

  await page.goto("http://localhost:3000/import");
  await page.waitForLoadState("networkidle");
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator("input[type=file]").setInputFiles(file);
    try {
      await page.getByText("تم التعرف على ملف حسابات المزرعة").waitFor({ timeout: 15000 });
      break;
    } catch {}
  }
  console.log("✓ workbook recognised");
  await page.screenshot({ path: "../scratch-workbook-card.png" }).catch(() => {});

  await page.getByRole("button", { name: /استورد كل شيء تلقائياً/ }).click();
  await page.getByRole("link", { name: "افتح لوحة النظرة العامة" }).waitFor({ timeout: 180000 });
  console.log("✓ all sheets finished");

  // Read the per-sheet results from the card
  const results = await page.locator("[dir=rtl] .rounded-lg.border").allInnerTexts();
  for (const r of results) console.log("  •", r.replace(/\n/g, " | "));
} finally {
  await browser.close();
}
console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "no page errors");

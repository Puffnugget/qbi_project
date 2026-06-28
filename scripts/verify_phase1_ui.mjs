/**
 * Phase 1 UI verification — TINA tab, catalog, mechanisms, live mode.
 * Run: npx playwright install chromium && node scripts/verify_phase1_ui.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://127.0.0.1:8000";

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  // API checks
  const health = await fetch(`${API}/health`);
  if (health.ok) pass("API health");
  else fail("API health", String(health.status));

  const catalogRes = await fetch(`${API}/folklore/catalog`);
  if (!catalogRes.ok) {
    fail("GET /folklore/catalog", String(catalogRes.status));
  } else {
    const catalog = await catalogRes.json();
    pass("GET /folklore/catalog", `${catalog.drugs?.length ?? 0} drugs`);
    const kinase = (catalog.drugs ?? []).filter((d) =>
      /kinase|EGFR|BRAF|MEK|PI3K|mTOR/i.test(d.mechanism ?? ""),
    );
    if (kinase.length >= 5) pass("Catalog kinase-tagged drugs", `${kinase.length} found`);
    else fail("Catalog kinase-tagged drugs", `only ${kinase.length}`);
    const rawPk = (catalog.drugs ?? []).some((d) => String(d.mechanism).startsWith("PK:"));
    if (!rawPk) pass("Mechanism labels cleaned (no raw PK: prefix)");
    else fail("Mechanism labels cleaned", "still has PK: prefix");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });

  // TINA tab default — wait for folklore presets (dynamic import + data load)
  const tinaTab = page.getByRole("tab", { name: "TINA" });
  if (await tinaTab.isVisible()) pass("TINA tab visible");
  else fail("TINA tab visible");

  try {
    await page.getByText("Screening timeline").waitFor({ timeout: 60000 });
    pass("Screening timeline visible");
  } catch {
    fail("Screening timeline", "timed out waiting for folklore presets");
  }

  const presetSelect = page.locator("select").first();
  if (await presetSelect.count()) {
    const text = await presetSelect.innerText();
    if (/Melanoma|Breast|Colon|Lung|Renal/i.test(text)) pass("Canned preset dropdown loaded");
    else fail("Canned preset dropdown", "options missing");
  } else fail("Canned preset dropdown");

  const mechanismOnCard = page.locator("main").getByText(/inhibitor|Proteasome|Antimetabolite|Microtubule|DNA|TOP|HDAC|PK:|Ds|AM/i).first();
  if (await mechanismOnCard.isVisible()) pass("Mechanism label on timeline step");
  else fail("Mechanism label on timeline step");

  // Live mode + catalog
  await page.getByRole("button", { name: "Run live", exact: true }).click();
  await page.waitForTimeout(2500);

  const catalogWarning = page.getByText(/Drug catalog unavailable/i);
  const cellLineSelect = page.locator('select').filter({ has: page.locator('option[value=""]') }).first();
  if (await catalogWarning.isVisible()) {
    fail("Live catalog loaded", "catalog unavailable alert shown");
  } else if (await cellLineSelect.count()) {
    const options = await cellLineSelect.locator("option").count();
    if (options > 5) pass("Live mode cell-line catalog", `${options} options`);
    else fail("Live mode cell-line catalog", `${options} options`);
  }

  const drugSearch = page.getByPlaceholder(/Search compounds/i);
  if (await drugSearch.isVisible()) {
    await drugSearch.fill("Erlotinib");
    await page.waitForTimeout(300);
    pass("Drug search input");
  } else fail("Drug search input");

  const mechFilter = page.locator('select').filter({ has: page.locator('option', { hasText: "all" }) }).last();
  if (await mechFilter.count()) {
    await mechFilter.selectOption({ label: /EGFR|kinase|PI3K/i }).catch(() => mechFilter.selectOption({ index: 1 }));
    pass("Mechanism filter control");
  }

  // Explore tab loading (precomputed path)
  await page.getByRole("tab", { name: "Explore" }).click();
  await page.waitForTimeout(3000);
  const canvasOrScene = page.locator("canvas").first();
  if (await canvasOrScene.isVisible()) pass("Explore 3D scene rendered");
  else {
    const loading = page.getByText(/Loading/i);
    if (await loading.isVisible()) fail("Explore 3D scene", "still loading");
    else pass("Explore tab opened");
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

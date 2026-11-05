import { chromium } from "playwright";

const baseUrl = process.env.UI_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ headless: true });
const discovery = await browser.newPage();
await discovery.goto(baseUrl, { waitUntil: "load" });
const reviewPath = await discovery.locator('a[href^="/review/"]').first().getAttribute("href");
if (!reviewPath) throw new Error("No review queue link was available for the UI audit.");
await discovery.goto(new URL(reviewPath, baseUrl).toString(), { waitUntil: "load" });
const packPath = await discovery.locator('a[href^="/pack/"]').first().getAttribute("href");
if (!packPath) throw new Error("No month-end pack link was available for the UI audit.");
await discovery.close();

const routes = ["/", "/upload", "/runs", "/guide", reviewPath, packPath];
const viewports = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "mobile", width: 390, height: 844 },
];
const failures = [];

for (const viewport of viewports) {
  for (const route of routes) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "load" });
    const audit = await page.evaluate(() => {
      const visibleHeights = (selector) =>
        [...document.querySelectorAll(selector)]
          .map((element) => Math.round(element.getBoundingClientRect().height))
          .filter((height) => height > 0);
      return {
        heading: document.querySelectorAll("main h1").length,
        activeNav: document.querySelectorAll(".main-nav a.active").length,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        shortButton: visibleHeights("button,.button").some((height) => height < 36),
        shortControl: visibleHeights(
          'input:not([type="checkbox"]):not([type="radio"]),select,textarea',
        ).some((height) => height < 36),
      };
    });
    const result = {
      viewport: viewport.name,
      route,
      status: response?.status(),
      ...audit,
      consoleErrors: consoleErrors.length,
    };
    const passed =
      response?.ok() &&
      audit.heading === 1 &&
      audit.activeNav === 1 &&
      !audit.overflow &&
      !audit.shortButton &&
      !audit.shortControl &&
      consoleErrors.length === 0;
    console.log(`${passed ? "PASS" : "FAIL"} ${JSON.stringify(result)}`);
    if (!passed) failures.push(result);

    if (route === reviewPath) {
      const firstItem = page.locator("details.item").first();
      await firstItem.locator("summary").click();
      const expanded = await firstItem.evaluate((element) => element.hasAttribute("open"));
      console.log(`${expanded ? "PASS" : "FAIL"} ${viewport.name} review row expands`);
      if (!expanded) failures.push({ viewport: viewport.name, route, interaction: "expand row" });
    }
    if (route === "/") {
      const trigger = page.locator(".actor-trigger");
      await trigger.click();
      const menu = page.locator(".actor-menu");
      const menuAudit = {
        visible: await menu.isVisible(),
        options: await menu.locator('[role="option"]').count(),
        selected: await menu.locator('[aria-selected="true"]').count(),
      };
      const menuPassed = menuAudit.visible && menuAudit.options === 6 && menuAudit.selected === 1;
      console.log(
        `${menuPassed ? "PASS" : "FAIL"} ${viewport.name} actor menu ${JSON.stringify(menuAudit)}`,
      );
      if (!menuPassed) failures.push({ viewport: viewport.name, route, interaction: "actor menu" });
      if (process.env.UI_AUDIT_SCREENSHOT && viewport.name === "desktop") {
        await page.waitForTimeout(200);
        await page.screenshot({ path: process.env.UI_AUDIT_SCREENSHOT, fullPage: false });
      }
      await page.keyboard.press("Escape");
      if (await menu.isVisible()) {
        failures.push({ viewport: viewport.name, route, interaction: "actor menu escape" });
      }
      await trigger.click();
      await page.locator(".actor-option", { hasText: "Staff A" }).click();
      const switched = page.locator(".actor-current strong", { hasText: "Staff A" });
      try {
        await switched.waitFor({ state: "visible", timeout: 5000 });
        console.log(`PASS ${viewport.name} actor switch submits`);
      } catch {
        console.log(`FAIL ${viewport.name} actor switch submits`);
        failures.push({ viewport: viewport.name, route, interaction: "actor switch" });
      }
    }
    await page.close();
  }
}

await browser.close();
if (failures.length > 0) {
  console.error(`UI audit failed with ${failures.length} problem(s).`);
  process.exit(1);
}
console.log(`UI audit passed: ${routes.length * viewports.length} route/viewport checks.`);

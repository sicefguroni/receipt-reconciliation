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

const routes = [
  "/",
  "/upload",
  "/runs",
  "/guide",
  reviewPath,
  `${reviewPath}?tab=3`,
  `${reviewPath}?tab=4`,
  packPath,
];
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
    if (route === "/upload") await page.locator(".select-trigger").first().waitFor();
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
          'input:not([type="checkbox"]):not([type="radio"]),select:not(.sr-only),textarea',
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
    if (route === `${reviewPath}?tab=4`) {
      const item = page
        .locator(".group.g4 details.item")
        .filter({ has: page.locator('input[value="reimburse"]') })
        .first();
      await item.locator(":scope > summary").click();
      const payment = item
        .locator("details.sub")
        .filter({ has: page.locator('input[value="reimburse"]') })
        .first();
      if (!(await payment.evaluate((element) => element.open))) {
        await payment.locator(":scope > summary").click();
      }
      const radio = payment.locator('input[value="reimburse"]');
      await radio.check();
      const spacing = await radio.evaluate((element) => {
        const control = element.getBoundingClientRect();
        const text = element.nextElementSibling.getBoundingClientRect();
        const form = element.closest("form");
        const nested = form.nextElementSibling;
        const formBox = form.lastElementChild.getBoundingClientRect();
        const nestedBox = nested?.getBoundingClientRect();
        return {
          radioHeight: control.height,
          aligned: Math.abs(control.top - text.top) <= 4,
          nestedGap: nestedBox ? nestedBox.top - formBox.bottom : null,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      const spacingPassed =
        spacing.radioHeight <= 20 &&
        spacing.aligned &&
        !spacing.overflow &&
        (spacing.nestedGap === null || spacing.nestedGap >= 12);
      console.log(
        `${spacingPassed ? "PASS" : "FAIL"} ${viewport.name} payment layout ${JSON.stringify(spacing)}`,
      );
      if (!spacingPassed)
        failures.push({ viewport: viewport.name, route, interaction: "payment spacing" });
      const picker = payment.getByRole("combobox", { name: "Another statement line", exact: true });
      await picker.click();
      const bounds = await page.locator(".select-menu").evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= 0 &&
          box.right <= window.innerWidth &&
          box.top >= 0 &&
          box.bottom <= window.innerHeight
        );
      });
      if (!bounds)
        failures.push({ viewport: viewport.name, route, interaction: "picker viewport bounds" });
      await picker.press("Escape");
      const requiredSelects = page.locator('.group.g4 select[name="receiptId"][required]');
      for (const native of await requiredSelects.all()) {
        if ((await native.inputValue()) !== "") continue;
        const lineItem = native.locator("xpath=ancestor::details[contains(@class, 'item')][1]");
        await lineItem.locator(":scope > summary").click();
        const requiredPicker = lineItem.getByRole("combobox", { name: "Receipt", exact: true });
        const valid = await native.evaluate((element) => element.checkValidity());
        await page.getByRole("listbox", { name: "Receipt", exact: true }).waitFor();
        if (
          valid ||
          !(await requiredPicker.evaluate((element) => element === document.activeElement))
        ) {
          failures.push({
            viewport: viewport.name,
            route,
            interaction: "required picker validation",
          });
        }
        await requiredPicker.press("Home");
        await requiredPicker.press("Enter");
        if (!(await native.evaluate((element) => element.checkValidity()))) {
          failures.push({
            viewport: viewport.name,
            route,
            interaction: "required picker selection",
          });
        }
        console.log(`PASS ${viewport.name} required picker validation and disabled placeholder`);
        break;
      }
      if (process.env.UI_REVIEW_SCREENSHOT && viewport.name === "desktop") {
        await item.screenshot({ path: process.env.UI_REVIEW_SCREENSHOT });
      }
    }
    if (route === "/upload") {
      const picker = page.getByRole("combobox", { name: "Paid with", exact: true });
      await picker.click();
      const menu = page.getByRole("listbox", { name: "Paid with", exact: true });
      await menu.getByRole("option", { name: "Personal card", exact: true }).click();
      const selected = await page.locator('select[name="paymentSource"]').evaluate((element) => ({
        value: element.value,
        submitted: new FormData(element.form).get("paymentSource"),
      }));
      const clickPassed =
        selected.value === "personal_card" && selected.submitted === "personal_card";
      if (!clickPassed)
        failures.push({ viewport: viewport.name, route, interaction: "picker submission" });
      await picker.press("ArrowDown");
      await picker.press("End");
      await picker.press("Enter");
      const keyboardPassed =
        (await page.locator('select[name="paymentSource"]').inputValue()) === "unknown";
      if (!keyboardPassed)
        failures.push({ viewport: viewport.name, route, interaction: "picker keyboard" });
      await picker.click();
      await picker.press("Escape");
      if (await menu.isVisible())
        failures.push({ viewport: viewport.name, route, interaction: "picker escape" });
      await picker.click();
      await picker.press("Tab");
      if (await menu.isVisible())
        failures.push({ viewport: viewport.name, route, interaction: "picker tab" });
      await picker.press("p");
      await picker.press("Enter");
      if ((await page.locator('select[name="paymentSource"]').inputValue()) !== "personal_card") {
        failures.push({ viewport: viewport.name, route, interaction: "picker typeahead" });
      }
      await picker.click();
      await page.locator("main h1").click();
      if (await menu.isVisible()) {
        failures.push({ viewport: viewport.name, route, interaction: "picker outside click" });
      }
      await page.locator("form.upload-form").evaluate((form) => form.reset());
      await page.waitForFunction(
        () => document.querySelector('select[name="paymentSource"]').value === "company_card",
      );
      console.log(
        `${clickPassed && keyboardPassed ? "PASS" : "FAIL"} ${viewport.name} styled picker selection, form value, keyboard and reset`,
      );
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

const fallback = await browser.newPage({ javaScriptEnabled: false });
await fallback.goto(new URL("/upload", baseUrl).toString(), { waitUntil: "load" });
const fallbackPicker = fallback.getByRole("combobox", { name: "Paid with", exact: true });
await fallbackPicker.selectOption("personal_card");
const fallbackPassed =
  (await fallbackPicker.inputValue()) === "personal_card" &&
  (await fallback.locator(".select-trigger").count()) === 0;
console.log(`${fallbackPassed ? "PASS" : "FAIL"} native dropdown fallback without JavaScript`);
if (!fallbackPassed) failures.push({ interaction: "no-JavaScript dropdown fallback" });
await fallback.close();

await browser.close();
if (failures.length > 0) {
  console.error(`UI audit failed with ${failures.length} problem(s).`);
  process.exit(1);
}
console.log(`UI audit passed: ${routes.length * viewports.length} route/viewport checks.`);

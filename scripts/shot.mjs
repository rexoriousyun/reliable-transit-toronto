/**
 * Screenshot the app in the states that matter: results list, peeked answer,
 * step-by-step, and a downtown street zoom. The wide view flatters everything,
 * so the street zoom is not optional.
 *
 *   node scripts/shot.mjs      (needs the API on :3000 and vite on :5173)
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright";

// The sandbox used to ship a browser at a fixed path and no Playwright cache,
// so the path was hardcoded. Both arrangements exist now, and a hardcoded path
// that is missing fails with "executable doesn't exist" rather than falling
// back — so probe, and let Playwright find its own download when the pinned
// build is absent.
const PINNED = "/opt/pw-browsers/chromium";
const b = await chromium.launch(existsSync(PINNED) ? { executablePath: PINNED } : {});

async function run(name, fromText, toText, opts = {}) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  const pick = async (label, text) => {
    await p.locator(`.field:has(.field-label:text-is("${label}")) input`).fill(text);
    await p.waitForTimeout(700);
    await p.locator(".suggestions li").first().click();
  };
  // Pinned, not "now": the app defaults to the rider's current time, and a
  // capture that moves with the clock cannot be compared with the last one.
  await p.locator('.when-field input[type="time"]').fill(opts.at ?? "09:00");
  await p.waitForTimeout(300);
  if (opts.stepFree === true) {
    await p.locator(".access-row").click();
    await p.waitForTimeout(200);
  }
  await pick("From", fromText);
  await pick("To", toText);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `/tmp/${name}-list.png` });

  // pick the first option -> sheet peeks, map takes over
  await p.locator(".journey").first().click();
  await p.waitForTimeout(1800);
  await p.evaluate(() => new Promise((r) => { const t = setTimeout(r, 6000); window.__map.once("idle", () => { clearTimeout(t); r(); }); }));
  await p.waitForTimeout(400);
  await p.screenshot({ path: `/tmp/${name}-peek.png` });

  // the other side of the toggle, so the two can be compared
  const allDay = p.locator('.view-toggle button:text-is("All day")');
  if (await allDay.count()) {
    await allDay.click();
    await p.waitForTimeout(1200);
    await p.screenshot({ path: `/tmp/${name}-allday.png` });
    await p.locator(".view-toggle button").first().click();
    await p.waitForTimeout(1000);
  }

  // open the step-by-step detail
  const steps = p.locator('.verdict-actions button:text-is("Step by step")');
  if (await steps.count()) { await steps.click(); await p.waitForTimeout(1600); await p.evaluate(() => { const s = document.querySelector(".sheet"); s.scrollTop = s.scrollHeight; }); await p.waitForTimeout(400); await p.screenshot({ path: `/tmp/${name}-steps.png` }); await steps.click(); await p.waitForTimeout(300); }

  if (opts.zoom) {
    await p.evaluate((z) => window.__map.easeTo({ center: z.center, zoom: z.zoom, duration: 0 }), opts.zoom);
    await p.evaluate(() => new Promise((r) => { const t = setTimeout(r, 6000); window.__map.once("idle", () => { clearTimeout(t); r(); }); }));
    await p.waitForTimeout(500);
    await p.screenshot({ path: `/tmp/${name}-zoom.png` });
  }
  const info = await p.evaluate(() => ({
    zoom: +window.__map.getZoom().toFixed(2),
    ride: window.__map.queryRenderedFeatures({ layers: ["journey-ride"] }).length,
    walk: window.__map.queryRenderedFeatures({ layers: ["journey-walk"] }).length,
  }));
  console.log(name, JSON.stringify(info));
  await p.close();
}

await run("long", "Jane St at Eglinton", "Union Station", {
  at: "09:00",
  zoom: { center: [-79.383, 43.650], zoom: 14.5 },
});
// A trip on a route the TTC has flagged today, so the "Today" block is in shot.
// Step-free on, into a station that is not step-free: the constraint is
// applied to the route and stated where it cannot be.
await run("access", "Lower Sherbourne St at Queens Quay", "College St at Bay St", {
  at: "09:00", stepFree: true, zoom: { center: [-79.383, 43.657], zoom: 14.5 },
});
await run("dt", "Spadina Ave At Queen", "Sherbourne Station", {
  at: "09:00",
  zoom: { center: [-79.383, 43.653], zoom: 14.5 },
});
await b.close();

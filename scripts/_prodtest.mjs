import { chromium } from "playwright";

const BASE = "https://merali.vercel.app";
const email = process.env.REPRO_EMAIL;
const password = process.env.REPRO_PW;

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const setCookieHeaders = [];
page.on("response", async (res) => {
  const h = res.headers();
  if (h["set-cookie"]) {
    setCookieHeaders.push({ url: res.url().replace(BASE, ""), status: res.status(), setCookie: h["set-cookie"].slice(0, 400) });
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await Promise.all([
  page.waitForLoadState("networkidle"),
  page.click('button[type=submit]'),
]);
await page.waitForTimeout(2500);

const afterLoginUrl = page.url();
const cookies = (await ctx.cookies()).map((c) => ({
  name: c.name, valueLen: c.value.length, domain: c.domain, path: c.path,
  secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, expires: c.expires,
}));

// fresh navigation to /dashboard (new request, same context cookies)
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const dashUrl = page.url();

console.log(JSON.stringify({
  afterLoginUrl,
  cookies,
  setCookieResponses: setCookieHeaders,
  dashboardLandedOn: dashUrl,
  bounced: dashUrl.includes("/login"),
}, null, 2));

await browser.close();

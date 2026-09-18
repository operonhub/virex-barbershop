import { chromium } from "playwright"
const browser = await chromium.launch({ channel: "chrome" })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => sessionStorage.setItem("virex:intro", "1"))
for (const path of ["/", "/agenda", "/bandeja?c=cv-matias", "/clientes", "/caja", "/finanzas", "/agente", "/ajustes", "/reservar"]) {
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message + " @ " + (e.stack || "").split("\n").slice(1, 4).join(" | ")))
  page.on("console", (m) => m.type() === "error" && errs.push("console: " + m.text().slice(0, 120)))
  await page.goto("http://localhost:3060" + path, { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  console.log(path, errs.length ? errs : "ok")
  await page.close()
}
await browser.close()

// Cuadros exactos de la intro: se congela el reloj (timers) y se posicionan
// las animaciones CSS en un instante dado con la Web Animations API.
import { mkdirSync } from "node:fs"
import { chromium } from "playwright"

mkdirSync("./shots", { recursive: true })
const browser = await chromium.launch({ channel: "chrome" })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.clock.install()
await page.goto("http://localhost:3060/?intro", { waitUntil: "networkidle" })
await page.evaluate(() => document.fonts.ready)
for (const t of [120, 420, 700, 1000, 1400]) {
  await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t }), t)
  await page.screenshot({ path: `./shots/intro-f${t}.png` })
}
// Salida: dispara el timer de "leave" y congela la transición a mitad de vuelo.
await page.evaluate(() => document.getAnimations().forEach((a) => { a.currentTime = 2000 }))
await page.clock.runFor(1400)
await page.waitForTimeout(50)
await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 260 }))
await page.screenshot({ path: "./shots/intro-leave.png" })
await browser.close()
console.log("ok")

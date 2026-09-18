// Capturas de verificación con el Chrome instalado (no descarga Chromium).
// Uso: node scripts/shot.mjs <ruta> <nombre> [ancho] [alto] [--full] [--intro=ms]
import { mkdirSync } from "node:fs"
import { chromium } from "playwright"

mkdirSync("./shots", { recursive: true })

const [, , path = "/", name = "shot", w = "1440", h = "900", ...flags] = process.argv
const full = flags.includes("--full")
const introFlag = flags.find((f) => f.startsWith("--intro="))
const browser = await chromium.launch({ channel: "chrome" })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const errors = []
page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()))
if (!introFlag) await page.addInitScript(() => sessionStorage.setItem("virex:intro", "1"))
await page.goto("http://localhost:3060" + path, { waitUntil: "networkidle" })
if (introFlag) {
  await page.waitForTimeout(+introFlag.split("=")[1])
} else {
  await page.waitForTimeout(600)
}
await page.screenshot({ path: `./shots/${name}.png`, fullPage: full })
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
console.log(JSON.stringify({ name, overflow, errors }))
await browser.close()

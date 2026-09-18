// Recorrido de verificación: intro, mobile, nuevo turno, cobro y reserva pública.
import { mkdirSync } from "node:fs"
import { chromium } from "playwright"

mkdirSync("./shots", { recursive: true })
const BASE = "http://localhost:3060"
const browser = await chromium.launch({ channel: "chrome" })
const log = []
const errors = []
const watch = (page) => {
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text().slice(0, 200)))
}

// 1. Intro cuadro a cuadro
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage(); watch(page)
  await page.goto(BASE + "/?intro", { waitUntil: "commit" })
  for (const ms of [250, 700, 1150, 1500, 2100]) {
    await page.waitForTimeout(ms - (log.at(-1)?.t ?? 0))
    log.push({ t: ms })
    await page.screenshot({ path: `./shots/intro-${ms}.png` })
  }
  const stillThere = await page.evaluate(() => document.documentElement.dataset.intro ?? null)
  console.log("intro attr after 2.1s:", stillThere)
  await ctx.close()
}

// 2. Mobile: Hoy y Bandeja
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  await ctx.addInitScript(() => sessionStorage.setItem("virex:intro", "1"))
  const page = await ctx.newPage(); watch(page)
  await page.goto(BASE + "/", { waitUntil: "networkidle" })
  await page.screenshot({ path: "./shots/m-hoy.png", fullPage: true })
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log("mobile hoy overflow:", ov)
  await page.goto(BASE + "/bandeja?c=cv-ezequiel", { waitUntil: "networkidle" })
  await page.screenshot({ path: "./shots/m-bandeja.png" })
  await page.goto(BASE + "/reservar", { waitUntil: "networkidle" })
  await page.screenshot({ path: "./shots/m-reservar.png", fullPage: true })
  // Reserva completa
  await page.getByRole("button", { name: /Corte \+ barba/ }).first().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: "./shots/m-reservar-2.png", fullPage: true })
  const slot = page.locator("button.num").first()
  await slot.click()
  await page.getByPlaceholder("Nombre y apellido").fill("Prueba Automática")
  await page.getByPlaceholder(/WhatsApp/).fill("1155554444")
  await page.getByRole("button", { name: "Confirmar turno" }).click()
  await page.getByText("¡Te esperamos!").waitFor({ timeout: 8000 })
  await page.screenshot({ path: "./shots/m-reservar-ok.png" })
  console.log("reserva pública: OK")
  await ctx.close()
}

// 3. Desktop: nuevo turno desde el diálogo
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript(() => sessionStorage.setItem("virex:intro", "1"))
  const page = await ctx.newPage(); watch(page)
  await page.goto(BASE + "/agenda", { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Nuevo turno" }).first().click()
  await page.getByPlaceholder(/Buscar por nombre/).fill("Mat")
  await page.waitForTimeout(200)
  await page.screenshot({ path: "./shots/d-nuevo-turno.png" })
  await page.locator('[data-slot="dialog-content"] li button').first().click()
  await page.getByRole("button", { name: /^Barba/ }).first().click()
  const free = page.locator('[data-slot="dialog-content"] button.num')
  const n = await free.count()
  if (n === 0) {
    // probar con otro barbero
    await page.getByRole("button", { name: /Bruno/ }).click()
  }
  await page.locator('[data-slot="dialog-content"] button.num').first().click()
  await page.screenshot({ path: "./shots/d-nuevo-turno-2.png" })
  await page.getByRole("button", { name: "Agendar" }).click()
  await page.getByText(/Turno agendado/).waitFor({ timeout: 8000 })
  console.log("nuevo turno: OK")

  // 4. Cobrar desde Caja
  await page.goto(BASE + "/caja", { waitUntil: "networkidle" })
  const cobrar = page.getByText("Cobrar →").first()
  if (await cobrar.count()) {
    await cobrar.click()
    await page.getByRole("button", { name: "Transferencia" }).click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: "./shots/d-cobrar.png" })
    await page.getByRole("button", { name: /^Cobrar \$/ }).click()
    await page.getByText(/Cobrado/).waitFor({ timeout: 8000 })
    console.log("cobro: OK")
  } else console.log("cobro: no había pendientes")

  await page.goto(BASE + "/agente", { waitUntil: "networkidle" })
  await page.screenshot({ path: "./shots/d-agente.png", fullPage: true })
  await page.goto(BASE + "/ajustes?tab=conexiones", { waitUntil: "networkidle" })
  await page.screenshot({ path: "./shots/d-ajustes.png" })
  await ctx.close()
}

console.log("errores:", errors.length ? errors : "ninguno")
await browser.close()

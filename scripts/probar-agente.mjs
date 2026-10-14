// Corre conversaciones de prueba en el "Probalo" de /agente y anota cada respuesta (largo, preguntas, si agendó).
// Uso: node scripts/probar-agente.mjs '[{"titulo":"...","mensajes":["hola","..."]}]'   (dev server en 3060; con la base real es un ensayo)
import { chromium } from "playwright"

const BASE = process.env.BASE ?? "http://localhost:3060"
const ESCENARIOS = JSON.parse(process.argv[2])

const browser = await chromium.launch({ channel: "chrome" })
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage()
await page.addInitScript(() => sessionStorage.setItem("virex:intro", "1"))
await page.goto(BASE + "/agente", { waitUntil: "networkidle" })

const input = page.getByPlaceholder("Escribí como un cliente…")
const bubbles = page.locator('section.panel div[class*="max-w-[85%]"]')
const errors = page.locator("section.panel p.text-danger")

for (const esc of ESCENARIOS) {
  const reset = page.getByRole("button", { name: "Reiniciar" })
  if (await reset.isVisible().catch(() => false)) await reset.click()
  console.log(`\n=== ${esc.titulo} ===`)
  for (const msg of esc.mensajes) {
    const before = (await bubbles.count()) + (await errors.count())
    await input.fill(msg)
    await input.press("Enter")
    await page.waitForFunction(
      (n) => document.querySelectorAll('section.panel div[class*="max-w-[85%]"]').length + document.querySelectorAll("section.panel p.text-danger").length >= n + 2,
      before,
      { timeout: 150_000 }
    ).catch(() => {})
    const errCount = await errors.count()
    const last = bubbles.last()
    const reply = (await last.innerText()).trim()
    const wrap = last.locator("xpath=..")
    const meta = (await wrap.locator("span.num").innerText().catch(() => "")).trim()
    const booked = await wrap.getByText("Turno creado en la agenda").count()
    console.log(`Cliente: ${msg}`)
    if (errCount) console.log(`  ERROR: ${(await errors.last().innerText()).trim()}`)
    console.log(`  Agente: ${reply}`)
    const preguntas = (reply.match(/\?/g) ?? []).length
    console.log(`  [${reply.length} car · ${preguntas} preg${booked ? " · AGENDÓ" : ""}${/tel[eé]fono|n[uú]mero/i.test(reply) ? " · PIDE TEL" : ""}] ${meta}`)
  }
}
await browser.close()

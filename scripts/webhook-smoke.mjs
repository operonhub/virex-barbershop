// Simula a Zernio: manda un mensaje entrante firmado al webhook y verifica
// que (1) se rechaza sin firma, (2) se acepta firmado, (3) un reintento no
// duplica, y (4) el mensaje aparece en la Bandeja.
import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
const secret = readFileSync(".env.local", "utf8").match(/ZERNIO_WEBHOOK_SECRET=(\S+)/)[1]
const URL_ = "http://localhost:3060/api/zernio/webhook"
const body = JSON.stringify({
  id: "evt_smoke_1",
  event: "message.received",
  account: { accountId: "acc_virex_wa", platform: "whatsapp" },
  conversation: { id: "cv-smoke", participantName: "Rodrigo Test", participantUsername: "+5491155550000" },
  message: { id: "msg_smoke_1", direction: "incoming", text: "Hola! tienen lugar el sábado a la mañana?", sentAt: new Date().toISOString(), platform: "whatsapp" },
  timestamp: new Date().toISOString(),
})
const sign = (b) => createHmac("sha256", secret).update(b, "utf8").digest("hex")
const post = (headers) => fetch(URL_, { method: "POST", headers: { "content-type": "application/json", ...headers }, body })
let r = await post({})
console.log("sin firma →", r.status)
r = await post({ "x-zernio-signature": sign(body) })
console.log("firmado →", r.status, await r.json())
r = await post({ "x-zernio-signature": sign(body) })
console.log("reintento →", r.status, await r.json())
await new Promise((res) => setTimeout(res, 1500))
const html = await (await fetch("http://localhost:3060/bandeja?c=cv-smoke")).text()
console.log("en la bandeja:", html.includes("Rodrigo Test"), "| mensaje:", html.includes("tienen lugar el sábado"), "| derivado por falta de clave:", html.includes("ANTHROPIC_API_KEY"))

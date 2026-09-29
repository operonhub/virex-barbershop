import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { parseXSignature, verifyMercadoPagoSignature } from "./signature"

const SECRET = "un-secreto-de-prueba-bien-largo"
const DATA_ID = "123456789"
const REQUEST_ID = "req-abc-123"
const TS = "1700000000000"

/** Firma "de verdad", igual que la calcula Mercado Pago del otro lado. */
function sign(dataId: string, requestId: string, ts: string, secret: string) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`
  return createHmac("sha256", secret).update(manifest).digest("hex")
}

describe("parseXSignature", () => {
  it("separa ts y v1 del header", () => {
    expect(parseXSignature(`ts=${TS},v1=abc123`)).toEqual({ ts: TS, v1: "abc123" })
  })

  it("tolera espacios alrededor de las comas", () => {
    expect(parseXSignature(`ts=${TS}, v1=abc123`)).toEqual({ ts: TS, v1: "abc123" })
  })

  it("null si falta el header o algún campo", () => {
    expect(parseXSignature(null)).toBeNull()
    expect(parseXSignature(`ts=${TS}`)).toBeNull()
    expect(parseXSignature("")).toBeNull()
  })
})

describe("verifyMercadoPagoSignature", () => {
  it("acepta una firma calculada igual que Mercado Pago", () => {
    const v1 = sign(DATA_ID, REQUEST_ID, TS, SECRET)
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${TS},v1=${v1}`, xRequestId: REQUEST_ID, dataId: DATA_ID, secret: SECRET })
    ).toBe(true)
  })

  it("rechaza con el secreto equivocado", () => {
    const v1 = sign(DATA_ID, REQUEST_ID, TS, "otro-secreto")
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${TS},v1=${v1}`, xRequestId: REQUEST_ID, dataId: DATA_ID, secret: SECRET })
    ).toBe(false)
  })

  it("rechaza si el id de pago no es el que se firmó (alguien mandó una notificación armada a mano)", () => {
    const v1 = sign(DATA_ID, REQUEST_ID, TS, SECRET)
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${TS},v1=${v1}`, xRequestId: REQUEST_ID, dataId: "999999999", secret: SECRET })
    ).toBe(false)
  })

  it("rechaza si falta x-request-id o el header", () => {
    const v1 = sign(DATA_ID, REQUEST_ID, TS, SECRET)
    expect(verifyMercadoPagoSignature({ xSignature: `ts=${TS},v1=${v1}`, xRequestId: null, dataId: DATA_ID, secret: SECRET })).toBe(false)
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: REQUEST_ID, dataId: DATA_ID, secret: SECRET })).toBe(false)
  })

  it("no explota con una v1 que no es hexadecimal válido", () => {
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${TS},v1=no-es-hex-válido`, xRequestId: REQUEST_ID, dataId: DATA_ID, secret: SECRET })
    ).toBe(false)
  })
})

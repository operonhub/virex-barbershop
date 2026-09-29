import { describe, expect, it } from "vitest"
import { retrying } from "./retry"

const noSleep = async () => {}

describe("reintentos acotados", () => {
  it("si sale bien a la primera, no reintenta", async () => {
    let calls = 0
    const out = await retrying(async () => (++calls, "ok"), (o) => o.failed, { delaysMs: [10, 10], sleep: noSleep })
    expect(out).toBe("ok")
    expect(calls).toBe(1)
  })

  it("reintenta un error pasajero y se recupera", async () => {
    let calls = 0
    const out = await retrying(
      async () => {
        if (++calls < 3) throw new Error("503")
        return "ok"
      },
      (o) => o.failed,
      { delaysMs: [10, 10], sleep: noSleep }
    )
    expect(out).toBe("ok")
    expect(calls).toBe(3)
  })

  it("también reintenta un resultado fallido que no es una excepción (como las respuestas de Zernio)", async () => {
    const seq = [{ ok: false as const, code: "rate_limited" }, { ok: true as const }]
    let i = 0
    const out = await retrying(async () => seq[i++], (o) => !o.failed && !o.value.ok, { delaysMs: [10], sleep: noSleep })
    expect(out.ok).toBe(true)
  })

  it("se rinde tras el último reintento y relanza el error", async () => {
    let calls = 0
    await expect(
      retrying(async () => {
        calls++
        throw new Error("sigue caído")
      }, (o) => o.failed, { delaysMs: [1, 1], sleep: noSleep })
    ).rejects.toThrow("sigue caído")
    expect(calls).toBe(3) // 1 intento + 2 reintentos
  })

  it("no reintenta lo que no es pasajero", async () => {
    let calls = 0
    await expect(
      retrying(async () => {
        calls++
        throw new Error("clave inválida")
      }, () => false, { delaysMs: [1, 1], sleep: noSleep })
    ).rejects.toThrow("clave inválida")
    expect(calls).toBe(1)
  })

  it("respeta el presupuesto de tiempo: si la espera ya no entra, corta", async () => {
    let t = 0
    let calls = 0
    const out = await retrying(
      async () => {
        calls++
        t += 20_000 // cada intento tarda 20 s
        return "falló"
      },
      () => true,
      { delaysMs: [1_500, 3_500], budgetMs: 40_000, now: () => t, sleep: async (ms) => void (t += ms) }
    )
    expect(out).toBe("falló")
    expect(calls).toBe(2) // el 3.º ya no entra en 40 s
  })

  it("espera lo indicado entre intentos", async () => {
    const waits: number[] = []
    await retrying(async () => "x", () => true, { delaysMs: [1_500, 3_500], sleep: async (ms) => void waits.push(ms) })
    expect(waits).toEqual([1_500, 3_500])
  })
})

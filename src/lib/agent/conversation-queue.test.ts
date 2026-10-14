import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createConversationQueue } from "./conversation-queue"

describe("una respuesta por conversación", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("dos mensajes seguidos: responde una sola vez", async () => {
    const run = vi.fn(async () => "respondió")
    const respond = createConversationQueue(run, "salteado", 4000)
    const a = respond("c1")
    await vi.advanceTimersByTimeAsync(1000)
    const b = respond("c1")
    await vi.advanceTimersByTimeAsync(4000)
    expect(await a).toBe("salteado")
    expect(await b).toBe("respondió")
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("si llega un mensaje mientras responde, espera a que termine", async () => {
    const order: string[] = []
    const run = vi.fn(async (id: string) => {
      order.push(`empieza ${run.mock.calls.length}`)
      await new Promise((r) => setTimeout(r, 10_000))
      order.push(`termina ${id}`)
      return "ok"
    })
    const respond = createConversationQueue(run, "salteado", 1000)
    const a = respond("c1")
    await vi.advanceTimersByTimeAsync(2000) // la primera ya está corriendo
    const b = respond("c1")
    await vi.advanceTimersByTimeAsync(30_000)
    await Promise.all([a, b])
    expect(order).toEqual(["empieza 1", "termina c1", "empieza 2", "termina c1"])
  })

  it("conversaciones distintas no se esperan entre sí", async () => {
    const run = vi.fn(async () => "ok")
    const respond = createConversationQueue(run, "salteado", 1000)
    const both = Promise.all([respond("c1"), respond("c2")])
    await vi.advanceTimersByTimeAsync(1000)
    expect(await both).toEqual(["ok", "ok"])
  })
})

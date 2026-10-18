import { describe, expect, it } from "vitest"
import { traceTool } from "./trace"

const names = { services: { s1: "Corte" }, staff: { b1: "Sebastián" } }

describe("registro de herramientas", () => {
  it("anota con qué datos consultó y qué horarios recibió", () => {
    const line = traceTool(
      "consultar_disponibilidad",
      { fecha: "2026-10-17", servicio_id: "s1", barbero_id: "b1", desde_hora: "16:00" },
      { ok: true, horarios: [{ hora: "18:00", barbero: "Sebastián" }, { hora: "18:45", barbero: "Sebastián" }] },
      names
    )
    expect(line).toBe("consultar_disponibilidad(fecha=2026-10-17, desde_hora=16:00, servicio=Corte, barbero=Sebastián) → 18:00 Sebastián, 18:45 Sebastián")
  })

  it("nunca guarda el nombre ni el teléfono del cliente", () => {
    const line = traceTool("crear_turno", { fecha: "2026-10-17", hora: "18:00", nombre_cliente: "Juan Pérez", telefono: "1133334444" }, { ok: true }, names)
    expect(line).not.toMatch(/Juan|1133/)
  })

  it("anota los errores", () => {
    expect(traceTool("crear_turno", { hora: "18:00" }, { ok: false, error: "Ese horario se acaba de ocupar." }, names)).toContain("error: Ese horario")
  })
})

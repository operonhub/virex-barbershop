import { describe, expect, it } from "vitest"
import { ownAccountIds } from "./scope"
import type { ZernioAccount } from "./types"

const account = (id: string, profile: string | null): ZernioAccount => ({
  zernioAccountId: id,
  zernioProfileId: profile,
  platform: "whatsapp",
  username: null,
  displayName: null,
  profileUrl: null,
  avatarUrl: null,
  isActive: true,
  followerCount: null,
})

describe("cuentas de Zernio que son de este panel", () => {
  const accounts = [account("wa-virex", "perfil-virex"), account("wa-operon", "perfil-operon"), account("ig-operon", "perfil-operon"), account("sin-perfil", null)]

  it("sólo deja las del profile de Virex", () => {
    const own = ownAccountIds(accounts, "perfil-virex")
    expect(own.has("wa-virex")).toBe(true)
    expect(own.has("wa-operon")).toBe(false)
    expect(own.has("ig-operon")).toBe(false)
  })

  it("una cuenta sin profile no se considera propia", () => {
    expect(ownAccountIds(accounts, "perfil-virex").has("sin-perfil")).toBe(false)
  })

  it("un profile que no existe no deja pasar nada", () => {
    expect(ownAccountIds(accounts, "otro").size).toBe(0)
  })
})

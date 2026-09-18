"use client"

import { useEffect, useRef } from "react"
import { VirexMark } from "./virex-mark"

/*
 * Quién decide si corre: `public/intro-boot.js`, cargado en el <head> antes
 * del primer pintado. Si marcó `html[data-intro=play]`, este componente la
 * reproduce y la retira; si no, queda con display:none y no hace nada.
 */

const PLAY_MS = 1320
const LEAVE_MS = 440

/** Anchos distintos para que la fila de LEDs no parezca un patrón. */
const LEDS = [0.72, 0.94, 0.58, 1, 0.8, 0.66]

export function IntroOverlay() {
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const mark = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const html = document.documentElement
    if (html.dataset.intro !== "play") return

    let doneTimer: number | undefined

    const finish = () => {
      delete html.dataset.intro
      window.removeEventListener("pointerdown", leave)
      window.removeEventListener("keydown", leave)
    }

    // El isotipo "vuela" hasta donde está el logo del panel (sidebar en
    // desktop, barra superior en mobile) mientras el fondo se desvanece:
    // parece que la marca se acomoda en su lugar en vez de desaparecer.
    function aimAtAnchor() {
      const anchor = Array.from(
        document.querySelectorAll<HTMLElement>("[data-brand-anchor]")
      ).find((el) => el.offsetParent !== null)
      if (!anchor || !mark.current || !stage.current) return
      const a = anchor.getBoundingClientRect()
      const m = mark.current.getBoundingClientRect()
      const s = stage.current.getBoundingClientRect()
      const mx = m.left + m.width / 2
      const my = m.top + m.height / 2
      stage.current.style.transformOrigin = `${mx - s.left}px ${my - s.top}px`
      stage.current.style.setProperty("--fly-x", `${a.left + a.width / 2 - mx}px`)
      stage.current.style.setProperty("--fly-y", `${a.top + a.height / 2 - my}px`)
      stage.current.style.setProperty("--fly-s", `${a.width / m.width}`)
    }

    function leave() {
      if (!root.current || root.current.classList.contains("is-leaving")) return
      window.clearTimeout(leaveTimer)
      aimAtAnchor()
      root.current.classList.add("is-leaving")
      doneTimer = window.setTimeout(finish, LEAVE_MS + 120)
    }

    const leaveTimer = window.setTimeout(leave, PLAY_MS)
    // Cualquier click o tecla la saltea: nadie tiene que esperar a la marca.
    window.addEventListener("pointerdown", leave, { once: true })
    window.addEventListener("keydown", leave, { once: true })

    // La limpieza sólo desarma timers y listeners. NO toca `data-intro`: en
    // desarrollo React monta, desmonta y vuelve a montar (StrictMode), y si
    // acá se borrara el atributo, el segundo montaje ya no vería la intro.
    return () => {
      window.clearTimeout(leaveTimer)
      window.clearTimeout(doneTimer)
      window.removeEventListener("pointerdown", leave)
      window.removeEventListener("keydown", leave)
    }
  }, [])

  return (
    <div ref={root} className="virex-intro" aria-hidden="true">
      <div className="virex-intro__leds">
        {LEDS.map((w, i) => (
          <span
            key={i}
            className="virex-intro__led"
            style={{ width: `${w * 100}%`, animationDelay: `${i * 55}ms` }}
          />
        ))}
      </div>

      <div ref={stage} className="virex-intro__stage">
        <div ref={mark}>
          <VirexMark size={124} detail animated title="" />
        </div>
        <div className="virex-intro__word font-display text-gold-metal text-[2.6rem] leading-none">
          VIREX
        </div>
        <div className="virex-intro__sub eyebrow -mt-2">Barbershop · Lanús Este</div>
      </div>
    </div>
  )
}

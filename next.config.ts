import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Hay un package-lock.json suelto en C:\Users\santi: sin esto, Turbopack
  // toma esa carpeta como raíz del proyecto.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // El botón flotante de Next en desarrollo tapa el sello de Operon y ensucia
  // las capturas de demo. Los errores igual se muestran en su overlay.
  devIndicators: false,
}

export default nextConfig

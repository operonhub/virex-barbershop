# Sistema de Gestión para Barberías

Panel de administración moderno para barberías. Incluye agenda, reservas online, métricas, pagos, conversaciones y un agente de IA integrado.

## Capturas de pantalla

> Próximamente.

## Módulos

| Módulo | Descripción |
|---|---|
| **Agenda** | Vista diaria/semanal de turnos |
| **Booking** | Reservas online de clientes |
| **Conversaciones** | Historial de chats con clientes |
| **Agente IA** | Asistente automatizado |
| **Métricas** | Estadísticas de negocio |
| **Pagos** | Registro de cobros |

---

## Requisitos previos

Necesitás tener instalado en tu computadora:

- **Node.js 18 o superior** → [Descargar aquí](https://nodejs.org/)
- **Git** → [Descargar aquí](https://git-scm.com/)
- *(Opcional)* **Claude Code** → para trabajar con IA

Para verificar que los tenés instalados, abrí una terminal y ejecutá:

```bash
node --version   # debe mostrar v18 o superior
git --version
```

---

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/jlucasacosta/sistemas-barberias.git
cd sistemas-barberias
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Iniciar en modo desarrollo

```bash
npm run dev
```

Abrí tu navegador en **http://localhost:5173** y vas a ver el sistema funcionando.

---

## Comandos disponibles

```bash
npm run dev       # Inicia el servidor de desarrollo con hot-reload
npm run build     # Genera la versión de producción en /dist
npm run preview   # Previsualiza la build de producción
npm run lint      # Revisa el código con ESLint
```

---

## Trabajar con Claude Code (opcional)

Claude Code es la herramienta de IA de Anthropic para desarrolladores. Podés usarla para entender, modificar y extender este proyecto.

### Instalación de Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Necesitás una cuenta en [claude.ai](https://claude.ai) y una API key de [Anthropic](https://console.anthropic.com/).

### Uso básico

1. Abrí una terminal en la carpeta del proyecto
2. Ejecutá:
   ```bash
   claude
   ```
3. Escribí lo que querés hacer en lenguaje natural. Ejemplos:
   - *"Agregá un módulo de inventario de productos"*
   - *"Cambiá el color principal a azul"*
   - *"Explicame cómo funciona el store de agenda"*

### Tips para aprovechar Claude Code al máximo

- Describí el **contexto** antes del pedido: *"Estoy en el módulo de Pagos y quiero..."*
- Si algo no quedó como esperabas, decile exactamente qué cambiar
- Podés pedirle que explique cualquier parte del código antes de modificarlo

---

## Estructura del proyecto

```
sistema-barberias/
├── src/
│   ├── pages/          # Páginas principales de cada módulo
│   │   ├── Agenda.tsx
│   │   ├── Agente.tsx
│   │   ├── Booking.tsx
│   │   ├── Conversaciones.tsx
│   │   ├── Metricas.tsx
│   │   └── Pagos.tsx
│   ├── store/          # Estado global (Zustand)
│   ├── lib/            # Utilidades y datos mock
│   └── types/          # Tipos TypeScript
├── index.html
├── vite.config.ts
└── package.json
```

---

## Stack tecnológico

- **React 19** + **TypeScript** — UI y tipado
- **Vite** — Build tool ultra-rápido
- **Tailwind CSS 4** — Estilos utility-first
- **Radix UI** — Componentes accesibles
- **Zustand** — Manejo de estado simple
- **Recharts** — Gráficos de métricas
- **React Router** — Navegación entre páginas

---

## Contribuir

1. Hacé un fork del repositorio
2. Creá una rama: `git checkout -b mi-feature`
3. Hacé tus cambios y commiteá: `git commit -m "feat: descripcion"`
4. Pusheá: `git push origin mi-feature`
5. Abrí un Pull Request

---

## Licencia

MIT — ver [LICENSE](./LICENSE) para más detalles.

Podés usar, copiar, modificar y distribuir este proyecto libremente, incluso en proyectos comerciales.

/**
 * Paleta de DATOS (sólo gráficos), validada con dataviz/validate_palette.js
 * contra la superficie #131210 en modo oscuro: pasa banda de luminosidad,
 * croma, separación para daltonismo (ΔE 21) y contraste.
 *
 *   este mes      #b48931  oro de datos (más profundo que el oro de la UI,
 *                          que es demasiado claro para marcas de gráfico)
 *   mes anterior  #4585bf  acero
 *
 * Módulo neutro a propósito (sin "use client"): lo usan tanto los gráficos
 * de recharts como las barras HTML que se renderizan en el servidor.
 */
export const DATA_GOLD = "#b48931"
export const DATA_STEEL = "#4585bf"

// WCAG 2.x contrast ratio between two sRGB colours given as #rrggbb.
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!match) throw new Error(`Not a #rrggbb colour: ${hex}`)
  const [r, g, b] = match.slice(1).map(part => channel(Number.parseInt(part!, 16)))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (lighter! + 0.05) / (darker! + 0.05)
}

/** Image SVG en data URI, pour la balise <img> de Satori. */
export function svgUri(svg: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(svg)) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

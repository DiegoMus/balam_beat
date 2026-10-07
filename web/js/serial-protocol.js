// Protocolo serial de Balam Beat (ver docs/PROTOCOLO_SERIAL.md)
//   D1..D4 -> mano dentro del haz     U1..U4 -> mano fuera del haz
//   BALAM,<versión>,<carriles> -> identificación     #... -> comentario

// Recibe el texto acumulado y devuelve los eventos de las líneas completas
// más el resto (línea incompleta) para la siguiente lectura.
export function parseSerialLines(buffer) {
  const events = [];
  const parts = buffer.split(/\r?\n/);
  const rest = parts.pop();
  for (const raw of parts) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const m = /^([DU])([1-9])$/.exec(line);
    if (m) {
      events.push({ type: m[1] === 'D' ? 'press' : 'release', lane: Number(m[2]) - 1 });
      continue;
    }
    const h = /^BALAM,([^,]+),(\d+)$/.exec(line);
    if (h) events.push({ type: 'hello', version: h[1], lanes: Number(h[2]) });
  }
  // protección: una "línea" sin fin de línea demasiado larga es ruido
  return { events, rest: rest.length > 256 ? '' : rest };
}

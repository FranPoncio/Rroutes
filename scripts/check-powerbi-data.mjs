/**
 * Verifica los datos generados en `powerbi/data/` y calcula los indicadores EVM
 * esperados a la fecha de corte.
 *
 *     npm run powerbi:check
 *
 * Sirve para dos cosas:
 *
 *  1. Guardar la síntesis del historial mensual. El último corte de cada paquete
 *     tiene que reproducir exacto el fixture de PMTool; si alguien toca la curva
 *     de interpolación y desalinea el final, esto falla.
 *  2. Dar los números contra los que contrastar el informe. Power BI calcula lo
 *     mismo en DAX por un camino distinto (SUMX sobre el modelo tabular): si las
 *     tarjetas del tablero no coinciden con esta salida, hay un error en las
 *     medidas.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR_CSV = join(dirname(fileURLToPath(import.meta.url)), "..", "powerbi", "data");

const DATA_DATE = "2026-07-30";

/** Valores del fixture PMTool a la fecha de corte, que el historial debe reproducir. */
const ESPERADO_EN_CORTE = {
  "wp-ing": { avanceFisico: 1.0, costoRealAcum: 910_000 },
  "wp-adq": { avanceFisico: 0.78, costoRealAcum: 3_150_000 },
  "wp-civ": { avanceFisico: 0.42, costoRealAcum: 1_650_000 },
  "wp-duc": { avanceFisico: 0.35, costoRealAcum: 2_950_000 },
  "wp-mon": { avanceFisico: 0.12, costoRealAcum: 780_000 },
};

// ────────────────────────────────────────────────────────────────────────────

/** Parser de CSV suficiente para lo que emite build-powerbi-data.mjs. */
function leerCsv(archivo) {
  const [encabezado, ...lineas] = readFileSync(join(DIR_CSV, archivo), "utf8").trim().split("\n");
  const columnas = encabezado.split(",");
  return lineas.map((linea) => {
    const celdas = linea.match(/("([^"]|"")*"|[^,]*)/g).filter((_, i) => i % 2 === 0);
    return Object.fromEntries(
      columnas.map((col, i) => {
        const bruto = (celdas[i] ?? "").replace(/^"|"$/g, "").replaceAll('""', '"');
        return [col, bruto];
      })
    );
  });
}

const paquetes = leerCsv("paquetes.csv").map((p) => ({
  ...p,
  presupuesto: Number(p.presupuesto),
}));
const avances = leerCsv("avances.csv").map((a) => ({
  ...a,
  avanceFisico: Number(a.avanceFisico),
  costoRealAcum: Number(a.costoRealAcum),
}));

const fallas = [];

// ── 1. El último corte tiene que ser el del fixture ─────────────────────────

for (const [wpId, esperado] of Object.entries(ESPERADO_EN_CORTE)) {
  const fila = avances.find((a) => a.workPackageId === wpId && a.fechaCorte === DATA_DATE);
  if (!fila) {
    fallas.push(`${wpId}: falta el corte del ${DATA_DATE}`);
    continue;
  }
  if (Math.abs(fila.avanceFisico - esperado.avanceFisico) > 1e-6) {
    fallas.push(`${wpId}: avance ${fila.avanceFisico} ≠ ${esperado.avanceFisico} (fixture)`);
  }
  if (fila.costoRealAcum !== esperado.costoRealAcum) {
    fallas.push(`${wpId}: costo ${fila.costoRealAcum} ≠ ${esperado.costoRealAcum} (fixture)`);
  }
}

// ── 2. Las curvas acumuladas tienen que ser monótonas ───────────────────────

for (const wp of paquetes) {
  const serie = avances
    .filter((a) => a.workPackageId === wp.id)
    .sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte));

  for (let i = 1; i < serie.length; i += 1) {
    if (serie[i].avanceFisico < serie[i - 1].avanceFisico - 1e-9) {
      fallas.push(`${wp.id}: el avance retrocede en ${serie[i].fechaCorte}`);
    }
    if (serie[i].costoRealAcum < serie[i - 1].costoRealAcum) {
      fallas.push(`${wp.id}: el costo acumulado retrocede en ${serie[i].fechaCorte}`);
    }
  }
  if (serie.some((a) => a.avanceFisico < 0 || a.avanceFisico > 1)) {
    fallas.push(`${wp.id}: hay avance fuera del rango 0..1`);
  }
}

// ── 3. EVM a la fecha de corte ──────────────────────────────────────────────

const aDia = (iso) => Date.parse(`${iso}T00:00:00Z`);
const curvaS = (t) => t * t * (3 - 2 * t);

/** Igual que la medida PV: curva S sobre la ventana de baseline de cada paquete. */
function plannedValue(fechaIso) {
  return paquetes.reduce((acc, wp) => {
    const inicio = aDia(wp.fechaInicioPlan);
    const fin = aDia(wp.fechaFinPlan);
    const ahora = aDia(fechaIso);
    const t =
      ahora <= inicio ? 0 : ahora >= fin || fin === inicio ? 1 : (ahora - inicio) / (fin - inicio);
    return acc + wp.presupuesto * curvaS(t);
  }, 0);
}

/** Último reporte de cada paquete con fecha ≤ la de corte, como hacen EV y AC. */
function vigentes(fechaIso) {
  return paquetes.map((wp) => {
    const previos = avances
      .filter((a) => a.workPackageId === wp.id && a.fechaCorte <= fechaIso)
      .sort((a, b) => a.fechaCorte.localeCompare(b.fechaCorte));
    return { wp, ultimo: previos.at(-1) };
  });
}

const bac = paquetes.reduce((acc, wp) => acc + wp.presupuesto, 0);
const pv = plannedValue(DATA_DATE);
const ev = vigentes(DATA_DATE).reduce(
  (acc, { wp, ultimo }) => acc + wp.presupuesto * (ultimo?.avanceFisico ?? 0),
  0
);
const ac = vigentes(DATA_DATE).reduce((acc, { ultimo }) => acc + (ultimo?.costoRealAcum ?? 0), 0);

const div = (a, b) => (b === 0 ? null : a / b);
const cpi = div(ev, ac);
const spi = div(ev, pv);
const eac = cpi === null ? null : div(bac, cpi);
const vac = eac === null ? null : bac - eac;

// ── Salida ──────────────────────────────────────────────────────────────────

const usd = (n) => (n === null ? "—" : `$${Math.round(n).toLocaleString("es-AR").padStart(12)}`);
const idx = (n) => (n === null ? "—" : n.toFixed(3));

console.log(`\nEVM al ${DATA_DATE} — ${paquetes.length} paquetes, ${avances.length} cortes\n`);
console.log(`  BAC  ${usd(bac)}`);
console.log(`  PV   ${usd(pv)}`);
console.log(`  EV   ${usd(ev)}`);
console.log(`  AC   ${usd(ac)}`);
console.log(`  SV   ${usd(ev - pv)}`);
console.log(`  CV   ${usd(ev - ac)}`);
console.log(`  SPI  ${idx(spi)}`);
console.log(`  CPI  ${idx(cpi)}`);
console.log(`  EAC  ${usd(eac)}   (BAC / CPI)`);
console.log(`  VAC  ${usd(vac)}`);
console.log(`  TCPI ${idx(div(bac - ev, bac - ac))}   (hasta BAC)`);
console.log(
  `\n  % avance real ${((100 * ev) / bac).toFixed(1)}%  ·  % avance plan ${((100 * pv) / bac).toFixed(1)}%\n`
);

if (fallas.length > 0) {
  console.error(`✗ ${fallas.length} problema(s):`);
  for (const f of fallas) console.error(`  · ${f}`);
  process.exit(1);
}

console.log("✓ El historial sintetizado cierra con el fixture de PMTool.\n");

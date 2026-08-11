/**
 * Genera los datos del proyecto Power BI (`powerbi/`) a partir del caso
 * GC-3 de PMTool.
 *
 * Emite dos cosas, siempre en sincronía:
 *
 *  1. `powerbi/data/*.csv` — los datos en plano, para inspeccionarlos, hacerles
 *     diff en un PR o engancharlos a un origen real.
 *  2. `powerbi/EVM-GC3.SemanticModel/definition/tables/*.tmdl` — las mismas
 *     tablas embebidas como literales `#table` de M. Van embebidas a propósito:
 *     Power BI no resuelve rutas relativas, así que un `.pbip` que apunte a un
 *     CSV solo abre en la máquina donde se creó. Embebido abre en cualquier lado.
 *
 * Los datos de origen replican `pmtool/src/fixtures/gasoducto.ts`. Si tocás el
 * fixture, tocá también `PAQUETES` / `AVANCE_FINAL` acá abajo y corré:
 *
 *     npm run powerbi
 *
 * IMPORTANTE — sobre el historial mensual: el fixture tiene un solo corte
 * (2026-07-30). Una curva S con un único punto de EV/AC no se puede graficar,
 * así que este script *sintetiza* los cortes mensuales previos interpolando
 * hacia atrás desde el valor real del fixture (ver `historialDeAvance`). El
 * último corte coincide exacto con el fixture; los anteriores son plausibles,
 * no medidos. Es dato de demo, igual que el fixture.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR_PBI = join(RAIZ, "powerbi");
const DIR_CSV = join(DIR_PBI, "data");
const DIR_TABLAS = join(DIR_PBI, "EVM-GC3.SemanticModel", "definition", "tables");

// ────────────────────────────────────────────────────────────────────────────
// Datos de origen — espejo de pmtool/src/fixtures/gasoducto.ts
// ────────────────────────────────────────────────────────────────────────────

/** Fecha de corte del tablero (data date). */
const DATA_DATE = "2026-07-30";

const PROYECTO = {
  id: "gc3",
  nombre: "Gasoducto Regional Norte — Tramo Compresión GC-3",
  tipo: "obra_civil",
  bac: 23_200_000,
  fechaInicio: "2025-09-01",
  fechaFinPlan: "2027-03-31",
  moneda: "USD",
};

// prettier-ignore
const PAQUETES = [
  // id,        nombre,                                  presupuesto,  peso, inicioPlan,   finPlan,      responsable
  ['wp-ing',    'Ingeniería de detalle',                     850_000,   3.7, '2025-09-01', '2026-03-31', 'M. Alcaraz'],
  ['wp-adq',    'Adquisición de cañería y válvulas',       4_200_000,  18.1, '2025-11-01', '2026-09-30', 'S. Duarte'],
  ['wp-civ',    'Obras civiles planta compresora',         3_100_000,  13.4, '2026-01-15', '2026-12-15', 'R. Ibáñez'],
  ['wp-duc',    'Tendido y soldadura de ducto',            6_800_000,  29.3, '2026-03-01', '2026-12-31', 'J. Molina'],
  ['wp-mon',    'Montaje electromecánico',                 5_400_000,  23.3, '2026-05-01', '2027-01-31', 'L. Ferreyra'],
  ['wp-scada',  'Instrumentación y SCADA',                 1_650_000,   7.1, '2026-08-01', '2027-02-28', 'P. Sosa'],
  ['wp-pru',    'Pruebas, precomisionado y habilitación',  1_200_000,   5.2, '2026-11-01', '2027-03-31', 'C. Vega'],
].map(([id, nombre, presupuesto, peso, fechaInicioPlan, fechaFinPlan, responsable]) => ({
  id,
  nombre,
  presupuesto,
  peso,
  fechaInicioPlan,
  fechaFinPlan,
  responsable,
}));

/** Avance vigente por paquete a `DATA_DATE`. Los que faltan no arrancaron. */
const AVANCE_FINAL = new Map([
  // id WP,      % avance, costo real acumulado
  ["wp-ing", { avanceFisico: 1.0, costoRealAcum: 910_000 }],
  ["wp-adq", { avanceFisico: 0.78, costoRealAcum: 3_150_000 }],
  ["wp-civ", { avanceFisico: 0.42, costoRealAcum: 1_650_000 }],
  ["wp-duc", { avanceFisico: 0.35, costoRealAcum: 2_950_000 }],
  ["wp-mon", { avanceFisico: 0.12, costoRealAcum: 780_000 }],
]);

/**
 * Exponente que desacopla la acumulación de costo de la de avance al
 * sintetizar el historial. Con 1 el CPI sería constante en el tiempo (plano y
 * poco informativo); con <1 el costo corre por delante del avance al principio
 * y el CPI se degrada mes a mes, que es cómo se forma un sobrecosto real.
 * Solo afecta a los cortes intermedios: el último siempre cae en el dato real.
 */
const EXP_COSTO = 0.85;

// ────────────────────────────────────────────────────────────────────────────
// Utilidades de fecha (UTC, día calendario — sin hora ni zona)
// ────────────────────────────────────────────────────────────────────────────

const aDia = (iso) => Date.parse(`${iso}T00:00:00Z`);
const aIso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Último día de cada mes entre `desdeIso` y `hastaIso`, más `hastaIso`. */
function cortesMensuales(desdeIso, hastaIso) {
  const hasta = aDia(hastaIso);
  const cortes = [];
  const d = new Date(aDia(desdeIso));
  d.setUTCDate(1);

  for (;;) {
    // Día 0 del mes siguiente = último día de este mes.
    const finDeMes = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
    if (finDeMes >= hasta) break;
    if (finDeMes > aDia(desdeIso)) cortes.push(aIso(finDeMes));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }

  cortes.push(hastaIso);
  return cortes;
}

// ────────────────────────────────────────────────────────────────────────────
// Síntesis del historial de avance
// ────────────────────────────────────────────────────────────────────────────

/** Curva S (smoothstep de Hermite), igual que `sCurve` en pmtool/src/core/evm.ts. */
const curvaS = (t) => t * t * (3 - 2 * t);

/** Tiempo transcurrido normalizado a [0,1] del paquete a una fecha. */
function tNormalizado(wp, fechaIso) {
  const inicio = aDia(wp.fechaInicioPlan);
  const fin = aDia(wp.fechaFinPlan);
  const ahora = aDia(fechaIso);
  if (ahora <= inicio) return 0;
  if (ahora >= fin || fin === inicio) return 1;
  return (ahora - inicio) / (fin - inicio);
}

/**
 * Reconstruye los cortes mensuales de un paquete hacia atrás desde su avance
 * real en `DATA_DATE`.
 *
 * El avance sigue la forma de la curva S reescalada para que valga exactamente
 * el avance real en la fecha de corte; el costo sigue al avance elevado a
 * `EXP_COSTO`. Por construcción el último corte reproduce el fixture.
 */
function historialDeAvance(wp) {
  const real = AVANCE_FINAL.get(wp.id);
  if (!real) return []; // paquete que todavía no arrancó

  const formaFinal = curvaS(tNormalizado(wp, DATA_DATE));
  if (formaFinal === 0) return [];

  return cortesMensuales(wp.fechaInicioPlan, DATA_DATE).map((fechaCorte) => {
    const ratio = curvaS(tNormalizado(wp, fechaCorte)) / formaFinal;
    return {
      id: `${wp.id}-${fechaCorte}`,
      workPackageId: wp.id,
      fechaCorte,
      avanceFisico: redondear(real.avanceFisico * ratio, 4),
      costoRealAcum: Math.round(real.costoRealAcum * ratio ** EXP_COSTO),
    };
  });
}

const redondear = (n, decimales) => Number(n.toFixed(decimales));

const avances = PAQUETES.flatMap(historialDeAvance);

// ────────────────────────────────────────────────────────────────────────────
// Salida 1 — CSV
// ────────────────────────────────────────────────────────────────────────────

/** Escapa un valor para CSV RFC 4180. */
function celda(valor) {
  const s = String(valor);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function escribirCsv(archivo, columnas, filas) {
  const cuerpo = filas.map((fila) => columnas.map((c) => celda(fila[c])).join(","));
  writeFileSync(join(DIR_CSV, archivo), [columnas.join(","), ...cuerpo, ""].join("\n"), "utf8");
}

// ────────────────────────────────────────────────────────────────────────────
// Salida 2 — TMDL con la tabla embebida como literal `#table` de M
// ────────────────────────────────────────────────────────────────────────────

/** Mapea el tipo lógico de la columna a (tipo M, tipo TMDL, formateador). */
const TIPOS = {
  text: { m: "text", tmdl: "string", lit: (v) => `"${String(v).replaceAll('"', '""')}"` },
  number: { m: "number", tmdl: "double", lit: (v) => String(v) },
  int: { m: "Int64.Type", tmdl: "int64", lit: (v) => String(v) },
  date: {
    m: "date",
    tmdl: "dateTime",
    lit: (v) => `#date(${v.slice(0, 4)}, ${Number(v.slice(5, 7))}, ${Number(v.slice(8, 10))})`,
  },
};

/**
 * Arma el archivo TMDL de una tabla.
 *
 * `columnas` es una lista de `[nombre, tipo, descripción]`. El orden manda: es
 * el orden de las columnas en el `#table` y en el panel de campos.
 */
function escribirTabla({ nombre, descripcion, columnas, filas, extra = "" }) {
  const sangria = (nivel, texto) => "\t".repeat(nivel) + texto;

  const defColumnas = columnas
    .map(([col, tipo, doc]) =>
      [
        sangria(1, `/// ${doc}`),
        sangria(1, `column ${col}`),
        sangria(2, `dataType: ${TIPOS[tipo].tmdl}`),
        ...(tipo === "date" ? [sangria(2, "formatString: yyyy-mm-dd")] : []),
        sangria(2, `summarizeBy: none`),
        sangria(2, `sourceColumn: ${col}`),
        "",
        sangria(2, `annotation SummarizationSetBy = Automatic`),
        ...(tipo === "date"
          ? ["", sangria(2, "annotation UnderlyingDateTimeDataType = Date")]
          : []),
      ].join("\n")
    )
    .join("\n\n");

  const tipoFila = columnas.map(([col, tipo]) => `${col} = ${TIPOS[tipo].m}`).join(", ");
  const literales = filas
    .map((fila) =>
      sangria(6, `{${columnas.map(([col, tipo]) => TIPOS[tipo].lit(fila[col])).join(", ")}}`)
    )
    .join(",\n");

  const particion = [
    sangria(1, `partition ${nombre} = m`),
    sangria(2, "mode: import"),
    sangria(2, "source ="),
    sangria(4, "let"),
    sangria(5, `Origen = #table(`),
    sangria(6, `type table [${tipoFila}],`),
    sangria(6, "{"),
    literales,
    sangria(6, "}"),
    sangria(5, ")"),
    sangria(4, "in"),
    sangria(5, "Origen"),
  ].join("\n");

  const contenido = [
    `/// ${descripcion}`,
    `table ${nombre}`,
    "",
    defColumnas,
    "",
    ...(extra ? [extra, ""] : []),
    particion,
    "",
    sangria(1, "annotation PBI_ResultType = Table"),
    "",
  ].join("\n");

  writeFileSync(join(DIR_TABLAS, `${nombre}.tmdl`), contenido, "utf8");
}

// ────────────────────────────────────────────────────────────────────────────
// Ejecución
// ────────────────────────────────────────────────────────────────────────────

mkdirSync(DIR_CSV, { recursive: true });
mkdirSync(DIR_TABLAS, { recursive: true });

const colsProyecto = [
  ["id", "text", "Identificador del proyecto."],
  ["nombre", "text", "Nombre del proyecto."],
  ["tipo", "text", "Tipo de proyecto (obra_civil, industrial, ti, servicios)."],
  ["bac", "number", "Budget At Completion: presupuesto total autorizado."],
  ["fechaInicio", "date", "Inicio del proyecto."],
  ["fechaFinPlan", "date", "Fin planificado (baseline)."],
  ["moneda", "text", "Código ISO 4217 de la moneda del proyecto."],
];

const colsPaquetes = [
  ["id", "text", "Identificador del paquete de trabajo."],
  ["nombre", "text", "Nombre del paquete de trabajo."],
  ["presupuesto", "number", "Presupuesto del paquete (parte del BAC)."],
  ["peso", "number", "Peso relativo del paquete dentro del proyecto."],
  ["fechaInicioPlan", "date", "Inicio planificado (baseline)."],
  ["fechaFinPlan", "date", "Fin planificado (baseline)."],
  ["responsable", "text", "Responsable del paquete."],
];

const colsAvances = [
  ["id", "text", "Identificador del reporte de avance."],
  ["workPackageId", "text", "Paquete de trabajo al que corresponde el avance."],
  ["fechaCorte", "date", "Fecha de corte del reporte (data date)."],
  ["avanceFisico", "number", "Avance físico acumulado del paquete, en 0..1."],
  ["costoRealAcum", "number", "Costo real acumulado (ACWP) del paquete a la fecha."],
];

escribirCsv(
  "proyecto.csv",
  colsProyecto.map(([c]) => c),
  [PROYECTO]
);
escribirCsv(
  "paquetes.csv",
  colsPaquetes.map(([c]) => c),
  PAQUETES
);
escribirCsv(
  "avances.csv",
  colsAvances.map(([c]) => c),
  avances
);

escribirTabla({
  nombre: "Proyecto",
  descripcion: "Cabecera del proyecto: presupuesto autorizado (BAC) y fechas de baseline.",
  columnas: colsProyecto,
  filas: [PROYECTO],
});

escribirTabla({
  nombre: "Paquetes",
  descripcion: "Paquetes de trabajo (WBS) con su presupuesto y sus fechas de baseline.",
  columnas: colsPaquetes,
  filas: PAQUETES,
});

escribirTabla({
  nombre: "Avances",
  descripcion:
    "Reportes de avance por paquete y fecha de corte. Solo el corte más reciente " +
    "sale del fixture de PMTool; los anteriores los sintetiza scripts/build-powerbi-data.mjs.",
  columnas: colsAvances,
  filas: avances,
});

const totalPresupuesto = PAQUETES.reduce((acc, wp) => acc + wp.presupuesto, 0);
if (totalPresupuesto !== PROYECTO.bac) {
  console.warn(
    `⚠  La suma de los presupuestos (${totalPresupuesto}) no coincide con el BAC del proyecto (${PROYECTO.bac}).`
  );
}

console.log(`✓ ${PAQUETES.length} paquetes, ${avances.length} cortes de avance`);
console.log(`  CSV   → powerbi/data/`);
console.log(`  TMDL  → powerbi/EVM-GC3.SemanticModel/definition/tables/`);

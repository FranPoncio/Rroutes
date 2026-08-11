/**
 * Genera el informe PBIR (`powerbi/EVM-GC3.Report/`).
 *
 * PBIR guarda cada visual en su propio JSON, así que un tablero de 20 visuales
 * son 20 archivos con mucha estructura repetida. Este script los emite desde una
 * descripción declarativa del layout — es más fácil de leer y de mover cosas de
 * lugar que 20 JSON a mano.
 *
 *     npm run powerbi
 *
 * ⚠ De ida nomás. En cuanto abras el .pbip en Power BI Desktop y guardes,
 * Desktop reescribe estos archivos con su propio formato (agrega lineageTags,
 * reordena propiedades, completa defaults). A partir de ahí Desktop es el dueño
 * del informe y volver a correr este script te pisa lo que hayas hecho. Sirve
 * para arrancar y para regenerar desde cero, no para ir y volver.
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR_REPORT = join(RAIZ, "powerbi", "EVM-GC3.Report");
const DIR_DEF = join(DIR_REPORT, "definition");

const ESQUEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition";

const ANCHO = 1280;
const ALTO = 720;

// ────────────────────────────────────────────────────────────────────────────
// Referencias a campos del modelo
// ────────────────────────────────────────────────────────────────────────────

/** Proyección de una medida de la tabla Medidas. */
const medida = (nombre) => ({
  field: {
    Measure: { Expression: { SourceRef: { Entity: "Medidas" } }, Property: nombre },
  },
  queryRef: `Medidas.${nombre}`,
  nativeQueryRef: nombre,
});

/** Proyección de una columna de una tabla. */
const columna = (tabla, nombre) => ({
  field: {
    Column: { Expression: { SourceRef: { Entity: tabla } }, Property: nombre },
  },
  queryRef: `${tabla}.${nombre}`,
  nativeQueryRef: nombre,
});

/** Literal de texto tal como lo espera el motor de expresiones del informe. */
const textoLiteral = (valor) => ({
  expr: { Literal: { Value: `'${valor.replaceAll("'", "''")}'` } },
});

/** Objeto `title` con texto fijo, para ponerle nombre a un visual. */
const titulo = (texto) => ({
  title: [
    { properties: { text: textoLiteral(texto), show: { expr: { Literal: { Value: "true" } } } } },
  ],
});

// ────────────────────────────────────────────────────────────────────────────
// Constructores de visuales
// ────────────────────────────────────────────────────────────────────────────

const tarjeta = (nombre, medidaNombre, pos) => ({
  nombre,
  pos,
  visualType: "card",
  roles: { Values: [medida(medidaNombre)] },
  objects: titulo(medidaNombre),
});

const texto = (nombre, contenido, pos, { tamaño = "20pt", peso = "bold" } = {}) => ({
  nombre,
  pos,
  visualType: "textbox",
  objects: {
    general: [
      {
        properties: {
          paragraphs: [
            {
              textRuns: [{ value: contenido, textStyle: { fontSize: tamaño, fontWeight: peso } }],
            },
          ],
        },
      },
    ],
  },
});

// ────────────────────────────────────────────────────────────────────────────
// Página 1 — Resumen ejecutivo
// ────────────────────────────────────────────────────────────────────────────

const KPIS = ["BAC", "PV", "EV", "AC", "CPI", "SPI"];

const paginaResumen = {
  nombre: "ResumenEVM",
  titulo: "Resumen EVM",
  visuales: [
    texto("tituloResumen", "Gasoducto GC-3 — Earned Value Management", {
      x: 16,
      y: 16,
      width: 760,
      height: 52,
    }),

    // El subtítulo es una medida, no texto fijo: la fecha de corte tiene que
    // salir del dato, para que nadie lea los KPI sin saber a qué día son.
    {
      nombre: "subtitulo",
      pos: { x: 792, y: 16, width: 472, height: 52 },
      visualType: "card",
      roles: { Values: [medida("Subtítulo")] },
      objects: { title: [{ properties: { show: { expr: { Literal: { Value: "false" } } } } }] },
    },

    // Fila de KPI: seis tarjetas parejas de borde a borde.
    ...KPIS.map((m, i) =>
      tarjeta(`kpi${m.replaceAll(" ", "")}`, m, {
        x: 16 + i * 208,
        y: 80,
        width: 196,
        height: 104,
      })
    ),

    // Curva S: PV completo de punta a punta del proyecto, EV y AC cortados en
    // el último avance reportado (las medidas devuelven BLANK más allá).
    {
      nombre: "curvaS",
      pos: { x: 16, y: 196, width: 760, height: 300 },
      visualType: "lineChart",
      roles: {
        Category: [columna("Calendario", "Mes")],
        Y: [medida("PV"), medida("EV"), medida("AC")],
      },
      objects: titulo("Curva S — planificado vs. ganado vs. real"),
    },

    // Proyección al cierre, a la derecha de la curva.
    tarjeta("proyEac", "EAC por CPI", { x: 792, y: 196, width: 230, height: 142 }),
    tarjeta("proyVac", "VAC", { x: 1034, y: 196, width: 230, height: 142 }),
    tarjeta("proyEtc", "ETC", { x: 792, y: 354, width: 230, height: 142 }),
    tarjeta("proyTcpi", "TCPI hasta BAC", { x: 1034, y: 354, width: 230, height: 142 }),

    {
      nombre: "desvioCostoPorPaquete",
      pos: { x: 16, y: 508, width: 760, height: 196 },
      visualType: "clusteredBarChart",
      roles: {
        Category: [columna("Paquetes", "nombre")],
        Y: [medida("CV")],
      },
      objects: titulo("Desvío de costo por paquete (CV)"),
    },

    {
      nombre: "filtroResponsable",
      pos: { x: 792, y: 508, width: 472, height: 196 },
      visualType: "slicer",
      roles: { Values: [columna("Paquetes", "responsable")] },
      objects: titulo("Responsable"),
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Página 2 — Detalle por paquete de trabajo
// ────────────────────────────────────────────────────────────────────────────

const paginaPaquetes = {
  nombre: "Paquetes",
  titulo: "Paquetes de trabajo",
  visuales: [
    texto("tituloPaquetes", "Detalle por paquete de trabajo", {
      x: 16,
      y: 16,
      width: 1248,
      height: 52,
    }),

    {
      nombre: "tablaPaquetes",
      pos: { x: 16, y: 80, width: 1248, height: 340 },
      visualType: "tableEx",
      roles: {
        Values: [
          columna("Paquetes", "nombre"),
          columna("Paquetes", "responsable"),
          medida("BAC"),
          medida("PV"),
          medida("EV"),
          medida("AC"),
          medida("SV"),
          medida("CV"),
          medida("SPI"),
          medida("CPI"),
        ],
      },
      objects: titulo("EVM por paquete"),
    },

    {
      nombre: "cpiPorPaquete",
      pos: { x: 16, y: 436, width: 616, height: 268 },
      visualType: "clusteredBarChart",
      roles: {
        Category: [columna("Paquetes", "nombre")],
        Y: [medida("CPI")],
      },
      objects: titulo("CPI por paquete — 1,00 es estar en plan"),
    },

    {
      nombre: "spiPorPaquete",
      pos: { x: 648, y: 436, width: 616, height: 268 },
      visualType: "clusteredBarChart",
      roles: {
        Category: [columna("Paquetes", "nombre")],
        Y: [medida("SPI")],
      },
      objects: titulo("SPI por paquete — 1,00 es estar en plan"),
    },
  ],
};

const PAGINAS = [paginaResumen, paginaPaquetes];

// ────────────────────────────────────────────────────────────────────────────
// Emisión
// ────────────────────────────────────────────────────────────────────────────

const escribirJson = (ruta, objeto) => {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `${JSON.stringify(objeto, null, 2)}\n`, "utf8");
};

rmSync(join(DIR_DEF, "pages"), { recursive: true, force: true });

escribirJson(join(DIR_DEF, "report.json"), {
  $schema: `${ESQUEMA}/report/2.0.0/schema.json`,
  layoutOptimization: "None",
});

escribirJson(join(DIR_DEF, "version.json"), {
  $schema: `${ESQUEMA}/versionMetadata/1.0.0/schema.json`,
  version: "2.0.0",
});

escribirJson(join(DIR_DEF, "pages", "pages.json"), {
  $schema: `${ESQUEMA}/pagesMetadata/1.0.0/schema.json`,
  pageOrder: PAGINAS.map((p) => p.nombre),
  activePageName: PAGINAS[0].nombre,
});

let totalVisuales = 0;

for (const pagina of PAGINAS) {
  const dirPagina = join(DIR_DEF, "pages", pagina.nombre);

  escribirJson(join(dirPagina, "page.json"), {
    $schema: `${ESQUEMA}/page/2.0.0/schema.json`,
    name: pagina.nombre,
    displayName: pagina.titulo,
    displayOption: "FitToPage",
    width: ANCHO,
    height: ALTO,
  });

  pagina.visuales.forEach((v, i) => {
    const { x, y, width, height } = v.pos;
    if (x + width > ANCHO || y + height > ALTO) {
      console.warn(`⚠  El visual "${v.nombre}" se sale del lienzo de ${ANCHO}×${ALTO}.`);
    }

    const visual = { visualType: v.visualType };

    if (v.roles) {
      visual.query = {
        queryState: Object.fromEntries(
          Object.entries(v.roles).map(([rol, proyecciones]) => [rol, { projections: proyecciones }])
        ),
      };
    }
    if (v.objects) visual.objects = v.objects;
    visual.drillFilterOtherVisuals = true;

    escribirJson(join(dirPagina, "visuals", v.nombre, "visual.json"), {
      $schema: `${ESQUEMA}/visualContainer/1.0.0/schema.json`,
      name: v.nombre,
      position: { x, y, z: i, width, height, tabOrder: i * 1000 },
      visual,
    });

    totalVisuales += 1;
  });
}

console.log(`✓ ${PAGINAS.length} páginas, ${totalVisuales} visuales`);
console.log(`  PBIR → powerbi/EVM-GC3.Report/definition/`);

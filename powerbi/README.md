# Tablero EVM en Power BI — Gasoducto GC-3

Proyecto **PBIP** (Power BI Project) con el tablero de Earned Value Management del
caso GC-3 de [PMTool](../pmtool). Todo el proyecto es texto plano: se versiona,
se revisa en un PR y se regenera con un comando.

```
powerbi/
├── EVM-GC3.pbip                  ← abrí este archivo con Power BI Desktop
├── EVM-GC3.SemanticModel/        ← modelo de datos y medidas DAX (TMDL)
├── EVM-GC3.Report/               ← páginas y visuales (PBIR, un JSON por visual)
└── data/                         ← los mismos datos en CSV, para inspeccionarlos
```

## Cómo abrirlo

1. Power BI Desktop → **Archivo › Abrir** → `powerbi/EVM-GC3.pbip`.
2. Necesitás una versión con formato PBIR habilitado. Es el formato por defecto
   desde marzo de 2026; en versiones anteriores hay que activarlo en
   **Opciones › Características en versión preliminar › Power BI Project (.pbip)**.

No hay que configurar ningún origen de datos: las tablas van embebidas en el
modelo como literales `#table` de M. Power BI no resuelve rutas relativas, así
que un `.pbip` que apuntara a `data/*.csv` solo abriría en la máquina donde se
creó — embebido abre en cualquier lado y el diff del PR muestra los datos.

## Qué contiene

**Página 1 — Resumen EVM.** Seis tarjetas (BAC, PV, EV, AC, CPI, SPI), la curva S
de planificado vs. ganado vs. real, las cuatro proyecciones al cierre (EAC, VAC,
ETC, TCPI) y el desvío de costo por paquete.

**Página 2 — Paquetes de trabajo.** Tabla con el EVM completo por paquete y dos
gráficos de barras con CPI y SPI, para ver de dónde sale el desvío.

### Las medidas

Están todas en la tabla `Medidas` y replican
[`pmtool/src/core/evm.ts`](../pmtool/src/core/evm.ts). Una diferencia de forma:
donde el TypeScript devuelve `null` al dividir por cero, el DAX usa `DIVIDE`, que
devuelve `BLANK` — misma semántica de «indefinido», no de cero.

Dos medidas sostienen a todas las demás:

- **`Último corte`** — la fecha del avance más reciente, ignorando filtros de
  fecha. Es el _data date_ real.
- **`Fecha de análisis`** — a qué fecha se evalúan PV, EV y AC. Si el visual
  filtra por fecha (el eje de meses de la curva S), usa el fin de ese período; si
  no (una tarjeta de KPI), usa el último corte reportado. Sin esto, las tarjetas
  mostrarían el PV al final del proyecto en vez del PV a hoy.

El **PV** se distribuye en el tiempo con una curva S (smoothstep de Hermite,
`3t²−2t³`) sobre la ventana de baseline de cada paquete, igual que `sCurve` en
PMTool. **EV** y **AC** toman, para cada paquete, su último reporte con fecha
menor o igual a la de análisis, y quedan en `BLANK` más allá del último corte
—así la línea del gráfico se corta ahí en vez de desplomarse a cero.

## Regenerar

```bash
npm run powerbi         # datos + informe + verificación
npm run powerbi:check   # solo la verificación
```

- `scripts/build-powerbi-data.mjs` → los CSV y las tablas TMDL.
- `scripts/build-powerbi-report.mjs` → las páginas y visuales PBIR.
- `scripts/check-powerbi-data.mjs` → verifica los datos y calcula el EVM esperado.

### Los números a la fecha de corte (2026-07-30)

`npm run powerbi:check` los calcula en JavaScript, por un camino distinto al DAX.
**Si el tablero no muestra esto, hay un error en las medidas:**

|                |             |
| -------------- | ----------: |
| BAC            | $23.200.000 |
| PV             | $11.323.519 |
| EV             |  $8.456.000 |
| AC             |  $9.440.000 |
| SV             | −$2.867.519 |
| CV             |   −$984.000 |
| SPI            |        0,75 |
| CPI            |        0,90 |
| EAC (BAC/CPI)  | $25.899.716 |
| VAC            | −$2.699.716 |
| TCPI hasta BAC |        1,07 |

La obra viene atrasada y con sobrecosto, empujada por el tendido del ducto: al
36,4 % de avance real contra un 48,8 % planificado, se proyecta cerrar $2,7 M por
encima del presupuesto autorizado.

## Advertencias

**El historial mensual es sintético.** El fixture de PMTool tiene un solo corte
(2026-07-30) y una curva S con un único punto de EV/AC no se puede graficar. El
generador interpola los cortes anteriores hacia atrás desde el valor real (ver
`historialDeAvance`). El último corte reproduce el fixture exacto —lo verifica
`powerbi:check`—; los anteriores son plausibles, no medidos.

**El informe se generó sin poder abrirlo.** El PBIR se escribió a mano contra la
estructura documentada del formato, pero Power BI Desktop solo corre en Windows y
los dominios de Microsoft están bloqueados en el entorno donde se generó, así que
no se pudo validar contra los JSON Schema oficiales ni abrir el resultado. El
modelo semántico es la parte sólida; si algún visual no carga, borrá su carpeta
en `EVM-GC3.Report/definition/pages/*/visuals/` y rehacelo desde la interfaz.

**Los generadores son de ida nomás.** En cuanto abras el `.pbip` y guardes,
Desktop reescribe estos archivos con su propio formato. A partir de ahí Desktop es
el dueño del informe y volver a correr `npm run powerbi` te pisa los cambios.
Sirve para arrancar y para regenerar desde cero, no para ir y volver.

## Enganchar datos reales

Los datos van embebidos en las particiones M de
`EVM-GC3.SemanticModel/definition/tables/*.tmdl`. Para cambiar de origen, reemplazá
el bloque `source =` de cada tabla por la consulta que corresponda —SQL Server,
Fabric Lakehouse, SharePoint, lo que sea— manteniendo los mismos nombres de
columna. Las medidas, las relaciones y todo el informe siguen funcionando sin
tocar nada más.

# 🌏 TRAVAPP

Aplicación web **bilingüe (ES/EN)** para **planificar viajes a los puntos más turísticos
de Argentina y Nueva Zelanda** (ambas islas), calculando las mejores rutas según tu
ubicación y tu medio de transporte. Un **selector de país** cambia entre 🇦🇷 Argentina y
🇳🇿 Nueva Zelanda, y un **toggle de idioma** alterna toda la interfaz y las fichas.

> Nota: el contenido de Nueva Zelanda está en español e inglés; el de Argentina, por ahora,
> en español (la interfaz sí es bilingüe en ambos países).

![Rutas Argentinas](https://commons.wikimedia.org/wiki/Special:FilePath/Obelisco_de_Buenos_Aires_2021.jpg?width=800)

## ✨ Qué hace

1. **Menú de destino.** Elegís la **localidad / región** (agrupada por provincia) y el **punto turístico** exacto al que querés ir.
2. **Rutas según tu ubicación, con prioridades.**
   - **Prioridad 1:** la ruta **más corta** desde tu punto de salida al destino.
   - **Prioridad 2:** una ruta **escénica** que pasa por otro punto turístico ubicado _de camino_ entre la salida y la llegada.
3. **Alternativas por medio de transporte.** Auto 🚗, moto 🏍️, bicicleta 🚲, monopatín 🛴, transporte público 🚌 o caminando 🚶. Cada modo recalcula distancia y tiempo con su propio perfil de ruteo.
4. **Mapa con estilo propio.** Base gris de OpenStreetMap (tiles CARTO Positron/Dark Matter según el tema) con filtro propio + pines personalizados.
5. **Pines interactivos.** Al hacer clic en cualquier pin se abre una ficha con **foto**, **reseña histórica**, **precio de entrada** y cómo llegar en **transporte público**.

### Además

- 🎨 **Tema claro/oscuro** con botón que respeta la preferencia de tu sistema (se recuerda tu elección).
- 🔤 **Tipografías modernas** (Fredoka + Nunito) vendorizadas localmente.
- 📌 **Pines coloreados por actividad**: cada pin usa el color de su sector (verde naturaleza, naranja trekking, azul museos, etc.); el destino se resalta con un aro.
- 🎟️ **Pin de eventos** en el centro de cada localidad: foto, reseña y enlace a la **agenda oficial de eventos**.
- 🏷️ **Filtro por 8 tipos de actividad**: naturaleza, trekking, museos, histórico, shopping, paseos, gastronomía y playas.
- 🎫 **Precio de entrada** de cada lugar (o si es gratis) — _orientativo_.
- 🚌 **Info de transporte público** para llegar a cada punto — _orientativa_.
- 📚 **413 puntos turísticos** (≈30 por localidad) en 14 localidades/regiones, incluyendo los valles cordobeses de **Punilla** y **Calamuchita**.

> ⚠ Los precios de entrada y la información de transporte son **orientativos**: Argentina tiene alta inflación y las líneas de colectivo cambian. Sirven como guía, no como dato oficial.

## 🗺️ Cómo funciona el ruteo

- El ruteo real usa el servidor público **[Valhalla](https://valhalla.readthedocs.io/) de OpenStreetMap** (`valhalla1.openstreetmap.de`), que no requiere API key y soporta justamente los 6 perfiles de transporte (`auto`, `motorcycle`, `bicycle`, `motor_scooter`, `bus`, `pedestrian`).
- La ubicación del usuario se obtiene con la **Geolocation API** del navegador. También podés **hacer clic en el mapa** para fijar el punto de salida.
- Si no hay conexión al ruteador, la app degrada con elegancia y muestra una **ruta estimada** (línea + tiempo según la velocidad típica del modo).

## 🚌 Transporte público real (GTFS)

Además del texto orientativo, la app muestra **transporte público derivado de datos GTFS oficiales**: para cada punto turístico calcula las **paradas y líneas reales** que pasan cerca (dentro de un radio configurable) y las muestra en la ficha (ej.: _"subte — líneas B, C · parada «Florida» a 104 m"_).

- El repo incluye feeds GTFS ya procesados en `assets/data/transporte-gtfs.json`:
  - **Subte de Buenos Aires** (`data/gtfs/subte-baires/`) — líneas de subte cercanas a los puntos de CABA.
  - **Interurbano de Córdoba** (`data/gtfs/interurbano-cordoba/`) — micros de larga distancia de los corredores **Punilla** (Córdoba → Carlos Paz, Cosquín, La Falda, La Cumbre, Capilla del Monte) y **Calamuchita** (Córdoba → Alta Gracia, Villa General Belgrano, Santa Rosa, Embalse), con las empresas que los conectan. Las paradas se ubican en el centro de cada localidad y los horarios son de relleno (no oficiales).
- El pipeline `scripts/build-gtfs.mjs` ingiere **cualquier feed GTFS** (carpetas locales o zips remotos) y regenera ese JSON:

  ```bash
  npm run gtfs
  ```

- Para sumar **colectivos y otras ciudades** (AMBA, Rosario, Córdoba, Mendoza…), agregá la URL del GTFS oficial en `scripts/gtfs-sources.json` y corré `npm run gtfs` (o disparás el workflow **"Actualizar datos GTFS"** desde la pestaña Actions, que lo hace y commitea solo).
- Donde no hay cobertura GTFS, la ficha usa la nota de transporte curada como respaldo.

## 🚀 Cómo ejecutarla

No necesita build. Al usar geolocalización y `fetch`, conviene servirla por HTTP (no abrir el archivo directamente):

```bash
# Desde la raíz del proyecto:
python3 -m http.server 8000
# luego abrí http://localhost:8000 en el navegador
```

> La geolocalización requiere `localhost` o HTTPS. En `localhost` funciona sin problemas.

## 📁 Estructura

```
.
├── index.html                 # Estructura de la app
├── assets/
│   ├── css/style.css          # Estilos, tema claro/oscuro, pines
│   ├── data/
│   │   └── transporte-gtfs.json  # Transporte real generado desde GTFS
│   ├── js/
│   │   ├── data.js            # Localidades, puntos turísticos, actividades y modos
│   │   └── app.js             # Lógica: mapa, ruteo, prioridades, filtros, GTFS, UI
│   └── vendor/                # Leaflet y fuentes (Fredoka, Nunito) vendorizados
├── data/gtfs/                 # Feeds GTFS crudos (Subte de Buenos Aires)
├── scripts/
│   ├── build-gtfs.mjs         # Pipeline GTFS -> transporte-gtfs.json
│   └── gtfs-sources.json      # Fuentes GTFS (locales y remotas)
└── README.md
```

## 🧭 Cómo agregar más lugares

Editá `assets/js/data.js`. Cada localidad tiene un arreglo `puntos`; agregá un objeto con
`id`, `nombre`, `categoria`, `lat`, `lng`, `img` (nombre de archivo en Wikimedia Commons vía el helper `wiki()`) y `sinopsis`.

## 🙌 Créditos de datos

- Cartografía: © OpenStreetMap contributors · © CARTO.
- Ruteo: proyecto Valhalla / OpenStreetMap.
- Imágenes: Wikimedia Commons (con _fallback_ automático si alguna no carga).

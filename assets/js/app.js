/* ============================================================
   Rutas Argentinas — lógica de la aplicación
   ============================================================ */

const VALHALLA_URL = "https://valhalla1.openstreetmap.de/route";

// Bases de mapa grises, según el tema.
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

// ------- Estado global -------
const estado = {
  pais: "ar", // "ar" | "nz"
  idioma: "es", // "es" | "en"
  localidad: null,
  destino: null,
  modo: MODOS[0],
  origen: null,
  rutas: [],
  actividades: new Set(), // vacío = todas
};

// ------- i18n -------
const I18N = {
  es: {
    subtitulo: "Viajá a los mejores puntos turísticos",
    pais: "País",
    actividad_q: "¿Qué querés hacer?",
    paso1: "¿A dónde vas?",
    localidad_label: "Localidad / región",
    destino_label: "Destino específico",
    paso2: "¿Cómo viajás?",
    paso3: "¿Desde dónde salís?",
    usar_ubicacion: "📍 Usar mi ubicación",
    origen_hint: "O hacé clic en el mapa para marcar tu punto de salida.",
    crear: "Crear rutas",
    rutas_sugeridas: "Rutas sugeridas",
    footer: "Precios y transporte son orientativos.",
    ph_localidad: "— Elegí una localidad —",
    ph_destino: "— Elegí un destino —",
    ph_destino_first: "— Elegí primero una localidad —",
    sin_puntos: "Sin puntos para ese filtro",
    calc: "Calculando las mejores rutas…",
    ruta_corta: "Ruta más corta",
    ruta_alt: "Ruta alternativa",
    ruta_esc: "Ruta escénica",
    prio1: "Prioridad 1",
    alt: "Alternativa",
    prio2: "Prioridad 2",
    estimada_short: "estimada",
    km: "km",
    tiempo: "tiempo est.",
    pasas_por: "Pasás por",
    entrada: "Entrada",
    transporte_pub: "Transporte público",
    transporte_gtfs: "Transporte (GTFS)",
    empresas: "empresas",
    lineas: "líneas",
    parada: "parada",
    eventos_agenda: "Eventos y agenda",
    agenda: "🔗 Agenda oficial de eventos",
    salida: "Salida",
    mi_ubicacion: "Mi ubicación",
    punto_mapa: "Punto marcado en el mapa",
    tu_salida: "Tu punto de salida",
    hacia: "hacia",
    estimadas: "(algunas rutas son estimadas por falta de conexión al ruteador)",
    geo_no: "Tu navegador no soporta geolocalización. Hacé clic en el mapa.",
    geo_obteniendo: "📍 Obteniendo ubicación…",
    geo_detectada: "📍 Ubicación detectada",
    geo_error: "No pudimos acceder a tu ubicación. Hacé clic en el mapa para marcar tu salida.",
  },
  en: {
    subtitulo: "Travel to the best sights",
    pais: "Country",
    actividad_q: "What do you want to do?",
    paso1: "Where to?",
    localidad_label: "Town / region",
    destino_label: "Specific destination",
    paso2: "How are you travelling?",
    paso3: "Where do you start?",
    usar_ubicacion: "📍 Use my location",
    origen_hint: "Or click on the map to set your starting point.",
    crear: "Create routes",
    rutas_sugeridas: "Suggested routes",
    footer: "Prices and transport are indicative.",
    ph_localidad: "— Choose a town —",
    ph_destino: "— Choose a destination —",
    ph_destino_first: "— Choose a town first —",
    sin_puntos: "No spots for that filter",
    calc: "Finding the best routes…",
    ruta_corta: "Shortest route",
    ruta_alt: "Alternative route",
    ruta_esc: "Scenic route",
    prio1: "Priority 1",
    alt: "Alternative",
    prio2: "Priority 2",
    estimada_short: "estimated",
    km: "km",
    tiempo: "est. time",
    pasas_por: "Passes by",
    entrada: "Entry",
    transporte_pub: "Public transport",
    transporte_gtfs: "Transport (GTFS)",
    empresas: "operators",
    lineas: "lines",
    parada: "stop",
    eventos_agenda: "Events & what's on",
    agenda: "🔗 Official events page",
    salida: "Start",
    mi_ubicacion: "My location",
    punto_mapa: "Point set on the map",
    tu_salida: "Your starting point",
    hacia: "to",
    estimadas: "(some routes are estimated — router offline)",
    geo_no: "Your browser doesn't support geolocation. Click on the map.",
    geo_obteniendo: "📍 Getting location…",
    geo_detectada: "📍 Location detected",
    geo_error: "We couldn't access your location. Click on the map to set your start.",
  },
};

function idiomaActual() {
  return localStorage.getItem("idioma") === "en" ? "en" : "es";
}
// Devuelve el texto de un campo bilingüe ({es,en}) o el string tal cual.
function t(campo) {
  if (campo == null) return "";
  return typeof campo === "object" ? campo[estado.idioma] || campo.es || campo.en || "" : campo;
}
// Devuelve una cadena de interfaz según el idioma.
function ui(k) {
  return (I18N[estado.idioma] && I18N[estado.idioma][k]) || I18N.es[k] || k;
}

// ------- Mapa -------
let map, capaPines, capaRutas, marcadorOrigen, capaTiles;

// =====================================================================
//  TEMA CLARO / OSCURO
// =====================================================================
function temaActual() {
  const guardado = localStorage.getItem("tema");
  if (guardado === "light" || guardado === "dark") return guardado;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema;
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = tema === "dark" ? "☀️" : "🌙";
  // Cambiar la base del mapa si ya está creado.
  if (map) {
    if (capaTiles) map.removeLayer(capaTiles);
    capaTiles = L.tileLayer(TILES[tema], {
      attribution: "© OpenStreetMap · © CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    capaTiles.bringToBack();
  }
}

function toggleTema() {
  const nuevo = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("tema", nuevo);
  aplicarTema(nuevo);
}

// =====================================================================
//  MAPA
// =====================================================================
function initMapa() {
  map = L.map("map", { zoomControl: true }).setView([-38.4, -63.6], 5);
  aplicarTema(document.documentElement.dataset.theme || temaActual());
  capaPines = L.layerGroup().addTo(map);
  capaRutas = L.layerGroup().addTo(map);
  map.on("click", (e) => setOrigen([e.latlng.lat, e.latlng.lng], ui("punto_mapa")));
}

function iconoPin({ tipo = "", emoji = "•", color = null }) {
  const style = color ? ` style="background:${color}"` : "";
  return L.divIcon({
    className: "",
    html: `<div class="pin ${tipo}"><div class="pin-body"${style}><span>${emoji}</span></div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

// Popup con foto, badges, sinopsis, entrada y transporte (requisitos 5, 4 y 8).
// Datos de transporte real derivados de GTFS (assets/data/transporte-gtfs.json).
let GTFS = {};
async function cargarGTFS() {
  try {
    const res = await fetch("assets/data/transporte-gtfs.json");
    if (res.ok) GTFS = await res.json();
  } catch {
    /* sin datos GTFS: se usa el texto curado como respaldo */
  }
}

const MODO_ICONO = {
  subte: "🚇",
  colectivo: "🚌",
  micro: "🚍",
  tren: "🚆",
  tranvía: "🚋",
  ferry: "⛴️",
  cable: "🚠",
};

// Fila de transporte del popup: usa GTFS real si hay cobertura; si no, el texto curado.
function transporteHTML(p) {
  const g = GTFS[p.id];
  if (g && g.lines && g.lines.length) {
    const ic = MODO_ICONO[g.modes[0]] || "🚏";
    const modos = g.modes.join(" · ");
    // "empresas" para micros de larga distancia; "líneas" para el resto.
    const etiqueta = g.modes[0] === "micro" ? ui("empresas") : ui("lineas");
    const lineas = g.lines.length > 10 ? g.lines.slice(0, 10).join(", ") + "…" : g.lines.join(", ");
    const dist = g.nearestM < 60 ? "" : ` a ${g.nearestM} m`;
    return `<div class="poi-row"><span class="ic">${ic}</span><span>
      <b>${ui("transporte_gtfs")}:</b> ${modos} — ${etiqueta} ${lineas}
      <span class="poi-gtfs">· ${ui("parada")} «${g.nearestStop}»${dist}</span></span></div>`;
  }
  return `<div class="poi-row"><span class="ic">🚌</span><span><b>${ui("transporte_pub")}:</b> ${t(p.transporte)}</span></div>`;
}

// Popup del pin de eventos: foto, sinopsis y enlace a la agenda oficial.
function popupEventos(ev, loc) {
  const cont = document.createElement("div");
  cont.className = "poi";
  const nombre = t(ev.nombre);
  cont.innerHTML = `
    <img class="poi-foto" src="${ev.img}" alt="${nombre}" />
    <div class="poi-info">
      <div class="poi-badges">
        <span class="poi-badge" style="background:#e11d48">🎟️ ${ui("eventos_agenda")}</span>
      </div>
      <h3>${nombre}</h3>
      <p>${t(ev.sinopsis)}</p>
      <a class="poi-link" href="${ev.url}" target="_blank" rel="noopener noreferrer">${ui("agenda")}</a>
      <div class="poi-loc">📍 ${loc.nombre}${loc.provincia ? " · " + t(loc.provincia) : ""}</div>
    </div>`;
  const img = cont.querySelector("img");
  img.addEventListener("error", () => {
    const ph = document.createElement("div");
    ph.className = "poi-foto-fallback";
    ph.textContent = nombre;
    img.replaceWith(ph);
  });
  return cont;
}

function popupPunto(p) {
  const act = ACTIVIDAD_POR_ID[p.actividad];
  const cont = document.createElement("div");
  cont.className = "poi";
  cont.innerHTML = `
    <img class="poi-foto" src="${p.img}" alt="${p.nombre}" />
    <div class="poi-info">
      <div class="poi-badges">
        <span class="poi-badge" style="background:${act.color}">${act.icon} ${t(act.nombre)}</span>
        <span class="poi-badge" style="background:#64748b">${t(p.categoria)}</span>
      </div>
      <h3>${p.nombre}</h3>
      <p>${t(p.sinopsis)}</p>
      <div class="poi-row"><span class="ic">🎫</span><span><b>${ui("entrada")}:</b> ${t(p.entrada)}</span></div>
      ${transporteHTML(p)}
      <div class="poi-loc">📍 ${p.localidadNombre || ""}${p.provincia ? " · " + t(p.provincia) : ""}</div>
    </div>`;
  const img = cont.querySelector("img");
  img.addEventListener("error", () => {
    const ph = document.createElement("div");
    ph.className = "poi-foto-fallback";
    ph.textContent = p.nombre;
    img.replaceWith(ph);
  });
  return cont;
}

// ¿Pasa el punto el filtro de actividad?
function pasaFiltro(p) {
  return estado.actividades.size === 0 || estado.actividades.has(p.actividad);
}

// Puntos de la localidad actual que pasan el filtro.
function puntosVisibles() {
  if (!estado.localidad) return [];
  return estado.localidad.puntos.filter(pasaFiltro);
}

function dibujarPines() {
  capaPines.clearLayers();
  if (marcadorOrigen) capaPines.addLayer(marcadorOrigen);
  if (!estado.localidad) return;

  puntosVisibles().forEach((p) => {
    const esDestino = estado.destino && p.id === estado.destino.id;
    const act = ACTIVIDAD_POR_ID[p.actividad];
    const punto = {
      ...p,
      localidadNombre: estado.localidad.nombre,
      provincia: estado.localidad.provincia,
    };
    // El pin toma el color de su actividad (mismo color que el chip del sector).
    const m = L.marker([p.lat, p.lng], {
      icon: iconoPin({
        tipo: esDestino ? "destino" : "",
        emoji: esDestino ? "★" : act.icon,
        color: act.color,
      }),
      zIndexOffset: esDestino ? 1000 : 0,
    });
    m.bindPopup(popupPunto(punto), { closeButton: true });
    capaPines.addLayer(m);
  });

  // Pin de eventos en el centro de la localidad (agenda oficial).
  if (estado.localidad.eventos) {
    const ev = estado.localidad.eventos;
    const m = L.marker([ev.lat, ev.lng], {
      icon: iconoPin({ tipo: "evento", emoji: "🎟️", color: "#e11d48" }),
      zIndexOffset: 900,
    });
    m.bindPopup(popupEventos(ev, estado.localidad), { closeButton: true });
    capaPines.addLayer(m);
  }
}

// =====================================================================
//  ORIGEN
// =====================================================================
function setOrigen(coords, etiqueta) {
  estado.origen = coords;
  document.getElementById("origen-estado").textContent =
    `✔ ${ui("salida")}: ${etiqueta} (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`;
  if (marcadorOrigen) capaPines.removeLayer(marcadorOrigen);
  marcadorOrigen = L.marker(coords, {
    icon: iconoPin({ tipo: "origen", emoji: "🧍" }),
    zIndexOffset: 1200,
  }).bindPopup(`<b>${ui("tu_salida")}</b>`);
  capaPines.addLayer(marcadorOrigen);
  actualizarBotonCrear();
}

function usarGeolocalizacion() {
  const btn = document.getElementById("btn-ubicacion");
  if (!navigator.geolocation) {
    document.getElementById("origen-estado").textContent = ui("geo_no");
    return;
  }
  btn.textContent = ui("geo_obteniendo");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setOrigen([pos.coords.latitude, pos.coords.longitude], ui("mi_ubicacion"));
      btn.textContent = ui("geo_detectada");
      btn.classList.add("ok");
      map.setView([pos.coords.latitude, pos.coords.longitude], 12);
    },
    () => {
      btn.textContent = ui("usar_ubicacion");
      document.getElementById("origen-estado").textContent = ui("geo_error");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// =====================================================================
//  GEOMETRÍA / RUTEO
// =====================================================================
function haversine(a, b) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180,
    la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function decodePolyline(str, precision = 6) {
  let index = 0,
    lat = 0,
    lng = 0;
  const coords = [],
    factor = Math.pow(10, precision);
  while (index < str.length) {
    let result = 1,
      shift = 0,
      b;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 1;
    shift = 0;
    do {
      b = str.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}

function fmtDuracion(seg) {
  const min = Math.round(seg / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

async function valhalla(locations, costing) {
  const body = {
    locations: locations.map((l) => ({ lat: l[0], lon: l[1] })),
    costing,
    alternates: 1,
    directions_options: { units: "kilometers" },
  };
  const url = `${VALHALLA_URL}?json=${encodeURIComponent(JSON.stringify(body))}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error("Valhalla " + res.status);
  return res.json();
}

function tripARuta(trip, meta) {
  const coords = [];
  trip.legs.forEach((leg) => decodePolyline(leg.shape).forEach((c) => coords.push(c)));
  return { coords, distancia: trip.summary.length, duracion: trip.summary.time, ...meta };
}

// Punto turístico "de camino" para la ruta escénica (prioridad 2).
function elegirPuntoEscenico(origen, destino) {
  const directo = haversine(origen, destino);
  let mejor = null,
    mejorDesvio = Infinity;
  TODOS_LOS_PUNTOS.forEach((p) => {
    const c = [p.lat, p.lng];
    if (Math.abs(c[0] - destino[0]) < 0.01 && Math.abs(c[1] - destino[1]) < 0.01) return;
    const desvio = haversine(origen, c) + haversine(c, destino) - directo;
    if (desvio > 0.3 && desvio < directo * 0.8 && desvio < mejorDesvio) {
      mejorDesvio = desvio;
      mejor = p;
    }
  });
  return mejor;
}

function rutaEstimada(waypoints, meta) {
  let dist = 0;
  for (let i = 1; i < waypoints.length; i++) dist += haversine(waypoints[i - 1], waypoints[i]);
  return {
    coords: waypoints,
    distancia: dist,
    duracion: (dist / estado.modo.velocidad) * 3600,
    estimada: true,
    ...meta,
  };
}

async function crearRutas() {
  if (!estado.origen || !estado.destino) return;
  mostrarLoader(true, ui("calc"));
  const origen = estado.origen;
  const destino = [estado.destino.lat, estado.destino.lng];
  const costing = estado.modo.costing;
  const rutas = [];

  try {
    const data = await valhalla([origen, destino], costing);
    const principal = tripARuta(data.trip, {
      nombreKey: "ruta_corta",
      tagKey: "prio1",
      tipo: "corta",
    });
    rutas.push(principal);
    if (data.alternates && data.alternates.length) {
      const alt = tripARuta(data.alternates[0].trip, {
        nombreKey: "ruta_alt",
        tagKey: "alt",
        tipo: "alternativa",
      });
      if (Math.abs(alt.distancia - principal.distancia) > 0.5) rutas.push(alt);
    }
  } catch (e) {
    rutas.push(
      rutaEstimada([origen, destino], { nombreKey: "ruta_corta", tagKey: "prio1", tipo: "corta" })
    );
  }

  const escenico = elegirPuntoEscenico(origen, destino);
  if (escenico) {
    const via = [escenico.lat, escenico.lng];
    try {
      const data = await valhalla([origen, via, destino], costing);
      rutas.push(
        tripARuta(data.trip, {
          nombreKey: "ruta_esc",
          tagKey: "prio2",
          tipo: "escenica",
          via: escenico.nombre,
        })
      );
    } catch (e) {
      rutas.push(
        rutaEstimada([origen, via, destino], {
          nombreKey: "ruta_esc",
          tagKey: "prio2",
          tipo: "escenica",
          via: escenico.nombre,
        })
      );
    }
  }

  estado.rutas = rutas;
  mostrarLoader(false);
  renderResultados();
  dibujarRuta(0);
}

function dibujarRuta(indice) {
  capaRutas.clearLayers();
  const r = estado.rutas[indice];
  if (!r) return;
  const color =
    r.tipo === "escenica" ? "#c084fc" : r.tipo === "alternativa" ? "#74acdf" : "#f6b40e";
  L.polyline(r.coords, { color: "#000", weight: 8, opacity: 0.22 }).addTo(capaRutas);
  L.polyline(r.coords, { color, weight: 5, opacity: 0.95, lineJoin: "round" }).addTo(capaRutas);
  document
    .querySelectorAll(".ruta-card")
    .forEach((el, i) => el.classList.toggle("activa", i === indice));
  map.fitBounds(L.latLngBounds(r.coords).pad(0.15));
}

// =====================================================================
//  DROPDOWN CUSTOM
// =====================================================================
function cerrarDropdowns(excepto) {
  document.querySelectorAll(".dropdown.abierto").forEach((d) => {
    if (d !== excepto) d.classList.remove("abierto");
  });
}

// options: [{value, label, sublabel, emoji, group}]
function construirDropdown(cont, { placeholder, options, valorSel, onSelect }) {
  const sel = options.find((o) => o.value === valorSel);
  let menuHTML = "";
  let grupoActual = null;
  options.forEach((o) => {
    if (o.group && o.group !== grupoActual) {
      grupoActual = o.group;
      menuHTML += `<div class="dropdown-group">${o.group}</div>`;
    }
    menuHTML += `<div class="dropdown-option ${o.value === valorSel ? "sel" : ""}" data-value="${o.value}">
      ${o.emoji ? `<span class="emoji">${o.emoji}</span>` : ""}
      <span>${o.label}${o.sublabel ? ` <small>· ${o.sublabel}</small>` : ""}</span></div>`;
  });
  cont.innerHTML = `
    <button type="button" class="dropdown-toggle ${sel ? "" : "placeholder"}">
      ${sel && sel.emoji ? `<span class="emoji">${sel.emoji}</span>` : ""}
      <span>${sel ? sel.label : placeholder}</span>
    </button>
    <div class="dropdown-menu">${menuHTML}</div>`;

  cont.querySelector(".dropdown-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    const abierto = cont.classList.contains("abierto");
    cerrarDropdowns(cont);
    cont.classList.toggle("abierto", !abierto);
  });
  cont.querySelectorAll(".dropdown-option").forEach((op) => {
    op.addEventListener("click", (e) => {
      e.stopPropagation();
      cont.classList.remove("abierto");
      onSelect(op.dataset.value);
    });
  });
}

// Localidades del país actualmente seleccionado.
function localidadesDelPais() {
  return LOCALIDADES.filter((l) => l.pais === estado.pais);
}

function renderDropdownLocalidad() {
  const porProvincia = {};
  localidadesDelPais().forEach((l) => (porProvincia[t(l.provincia)] ||= []).push(l));
  const options = [];
  Object.keys(porProvincia)
    .sort()
    .forEach((prov) => {
      porProvincia[prov].forEach((l) =>
        options.push({ value: l.id, label: l.nombre, group: prov, emoji: "📍" })
      );
    });
  construirDropdown(document.getElementById("dd-localidad"), {
    placeholder: ui("ph_localidad"),
    options,
    valorSel: estado.localidad?.id,
    onSelect: (id) => seleccionarLocalidad(id),
  });
}

function renderDropdownDestino() {
  const cont = document.getElementById("dd-destino");
  if (!estado.localidad) {
    construirDropdown(cont, {
      placeholder: ui("ph_destino_first"),
      options: [],
      onSelect: () => {},
    });
    return;
  }
  const vis = puntosVisibles();
  const options = vis.map((p) => {
    const act = ACTIVIDAD_POR_ID[p.actividad];
    return { value: p.id, label: p.nombre, sublabel: t(act.nombre), emoji: act.icon };
  });
  construirDropdown(cont, {
    placeholder: vis.length ? ui("ph_destino") : ui("sin_puntos"),
    options,
    valorSel: estado.destino?.id,
    onSelect: (id) => seleccionarDestino(id),
  });
}

// =====================================================================
//  CHIPS DE ACTIVIDAD
// =====================================================================
function renderChips() {
  const cont = document.getElementById("chips-actividad");
  cont.innerHTML = "";
  ACTIVIDADES.forEach((a) => {
    const activo = estado.actividades.has(a.id);
    const el = document.createElement("button");
    el.type = "button";
    el.className = "chip" + (activo ? " activo" : "");
    if (activo) el.style.background = a.color;
    el.innerHTML = `<span class="ico">${a.icon}</span>${t(a.nombre)}`;
    el.addEventListener("click", () => {
      if (estado.actividades.has(a.id)) estado.actividades.delete(a.id);
      else estado.actividades.add(a.id);
      aplicarFiltroActividad();
    });
    cont.appendChild(el);
  });
}

function aplicarFiltroActividad() {
  renderChips();
  // Si el destino actual ya no pasa el filtro, elegir el primero visible.
  if (estado.destino && !pasaFiltro(estado.destino)) {
    const vis = puntosVisibles();
    estado.destino = vis[0] || null;
  }
  renderDropdownDestino();
  dibujarPines();
  actualizarBotonCrear();
}

// =====================================================================
//  SELECCIONES
// =====================================================================
function seleccionarLocalidad(id) {
  estado.localidad = LOCALIDADES.find((l) => l.id === id) || null;
  estado.rutas = [];
  capaRutas.clearLayers();
  document.getElementById("resultados").classList.add("hidden");
  const vis = puntosVisibles();
  estado.destino = vis[0] || null;
  renderDropdownLocalidad();
  renderDropdownDestino();
  dibujarPines();
  if (estado.localidad) map.setView(estado.localidad.center, estado.localidad.zoom);
  actualizarBotonCrear();
}

function seleccionarDestino(id) {
  estado.destino = estado.localidad.puntos.find((p) => p.id === id) || null;
  renderDropdownDestino();
  dibujarPines();
  actualizarBotonCrear();
}

// =====================================================================
//  MODOS
// =====================================================================
function renderModos() {
  const cont = document.getElementById("modos");
  cont.innerHTML = "";
  MODOS.forEach((m) => {
    const el = document.createElement("div");
    el.className = "modo" + (m.id === estado.modo.id ? " activo" : "");
    el.innerHTML = `<span class="ico">${m.icon}</span><span class="txt">${t(m.nombre)}</span>`;
    el.addEventListener("click", () => {
      estado.modo = m;
      renderModos();
      if (estado.rutas.length && estado.origen && estado.destino) crearRutas();
    });
    cont.appendChild(el);
  });
}

// =====================================================================
//  RESULTADOS
// =====================================================================
function renderResultados() {
  const cont = document.getElementById("resultados");
  const lista = document.getElementById("lista-rutas");
  const hint = document.getElementById("resultados-hint");
  cont.classList.remove("hidden");
  lista.innerHTML = "";
  const alguna = estado.rutas.some((r) => r.estimada);
  hint.textContent =
    `${estado.modo.icon} ${t(estado.modo.nombre)} · ${ui("hacia")} ${estado.destino.nombre}` +
    (alguna ? " · " + ui("estimadas") : "");
  estado.rutas.forEach((r, i) => {
    const nombre = ui(r.nombreKey) + (r.estimada ? ` (${ui("estimada_short")})` : "");
    const card = document.createElement("div");
    card.className = "ruta-card" + (r.tipo === "escenica" ? " escenica" : "");
    card.innerHTML = `
      <div class="titulo">${nombre}
        <span class="ruta-tag ${r.tipo === "escenica" ? "escenica" : ""}">${ui(r.tagKey)}</span></div>
      <div class="datos">
        <div class="dato"><b>${r.distancia.toFixed(1)}</b><small>${ui("km")}</small></div>
        <div class="dato"><b>${fmtDuracion(r.duracion)}</b><small>${ui("tiempo")}</small></div>
      </div>
      ${r.via ? `<div class="via">✨ ${ui("pasas_por")}: ${r.via}</div>` : ""}`;
    card.addEventListener("click", () => dibujarRuta(i));
    lista.appendChild(card);
  });
}

function actualizarBotonCrear() {
  document.getElementById("btn-crear").disabled = !(estado.origen && estado.destino);
}

function mostrarLoader(mostrar, texto) {
  const l = document.getElementById("loader");
  if (texto) document.getElementById("loader-text").textContent = texto;
  l.classList.toggle("hidden", !mostrar);
}

// =====================================================================
//  PAÍS E IDIOMA
// =====================================================================
function renderPaisSelector() {
  const cont = document.getElementById("pais-selector");
  cont.innerHTML = "";
  PAISES.forEach((pa) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "pais-btn" + (pa.id === estado.pais ? " activo" : "");
    el.innerHTML = `<span class="pais-flag">${pa.flag}</span>${t(pa.nombre)}`;
    el.addEventListener("click", () => seleccionarPais(pa.id));
    cont.appendChild(el);
  });
}

function seleccionarPais(id) {
  if (id === estado.pais) return;
  estado.pais = id;
  estado.localidad = null;
  estado.destino = null;
  estado.rutas = [];
  capaRutas.clearLayers();
  capaPines.clearLayers();
  if (marcadorOrigen) capaPines.addLayer(marcadorOrigen);
  document.getElementById("resultados").classList.add("hidden");
  const pa = PAISES.find((p) => p.id === id);
  if (pa) map.setView(pa.center, pa.zoom);
  renderPaisSelector();
  renderDropdownLocalidad();
  renderDropdownDestino();
  actualizarBotonCrear();
}

function toggleIdioma() {
  estado.idioma = estado.idioma === "es" ? "en" : "es";
  localStorage.setItem("idioma", estado.idioma);
  aplicarIdioma();
}

function aplicarIdioma() {
  document.documentElement.lang = estado.idioma;
  // Textos estáticos marcados con data-i18n.
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = ui(el.dataset.i18n);
  });
  // El botón de idioma muestra el idioma al que se cambia.
  const lb = document.getElementById("lang-toggle");
  if (lb) lb.textContent = estado.idioma === "es" ? "EN" : "ES";
  // Botón de ubicación (si no fue usado) y hint de origen.
  const bu = document.getElementById("btn-ubicacion");
  if (bu && !bu.classList.contains("ok")) bu.textContent = ui("usar_ubicacion");
  const oe = document.getElementById("origen-estado");
  if (oe && !estado.origen) oe.textContent = ui("origen_hint");
  // Re-render de todo lo dinámico.
  renderPaisSelector();
  renderChips();
  renderModos();
  renderDropdownLocalidad();
  renderDropdownDestino();
  dibujarPines();
  if (estado.rutas.length && estado.destino) renderResultados();
}

// =====================================================================
//  ARRANQUE
// =====================================================================
function main() {
  estado.idioma = idiomaActual();
  aplicarTema(temaActual());
  initMapa();
  const pa = PAISES.find((p) => p.id === estado.pais);
  if (pa) map.setView(pa.center, pa.zoom);
  aplicarIdioma(); // renderiza país, chips, modos, dropdowns y textos

  document.getElementById("theme-toggle").addEventListener("click", toggleTema);
  document.getElementById("lang-toggle").addEventListener("click", toggleIdioma);
  document.getElementById("btn-ubicacion").addEventListener("click", usarGeolocalizacion);
  document.getElementById("btn-crear").addEventListener("click", crearRutas);
  document.addEventListener("click", () => cerrarDropdowns(null));

  // Cargar transporte GTFS real (asíncrono); al llegar, refrescar pines abiertos.
  cargarGTFS().then(() => {
    if (estado.localidad) dibujarPines();
  });
}

document.addEventListener("DOMContentLoaded", main);

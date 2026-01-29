import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mcp-app.css";
import arrondissementsGeoJson from "./data/arrondissements.geojson.json";

interface DvfStats {
  arrondissement: number;
  nom: string;
  appartements: { prix_moyen: number; prix_median: number; nb_ventes: number };
  maisons: { prix_moyen: number; prix_median: number; nb_ventes: number };
  coords: { lat: number; lon: number };
}

const mainEl = document.querySelector(".main") as HTMLElement;
const titleEl = document.getElementById("title")!;
const badgeEl = document.getElementById("badge-type")!;
const prixMoyenEl = document.getElementById("prix-moyen")!;
const prixMedianEl = document.getElementById("prix-median")!;
const nbVentesEl = document.getElementById("nb-ventes")!;
const btnAppart = document.getElementById("btn-appart")!;
const btnMaison = document.getElementById("btn-maison")!;

let currentStats: DvfStats | null = null;
let currentType: "appartements" | "maisons" = "appartements";

let map: L.Map | null = null;
let highlightLayer: L.GeoJSON | null = null;

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl || map) return;

  map = L.map(mapEl, {
    scrollWheelZoom: false,
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OSM",
    maxZoom: 18,
  }).addTo(map);

  L.geoJSON(arrondissementsGeoJson as GeoJSON.FeatureCollection, {
    style: {
      color: "#999",
      weight: 1,
      fillColor: "#ddd",
      fillOpacity: 0.15,
    },
  }).addTo(map);

  map.fitBounds(
    L.geoJSON(arrondissementsGeoJson as GeoJSON.FeatureCollection).getBounds(),
    { padding: [10, 10] },
  );

  new ResizeObserver(() => map?.invalidateSize()).observe(mapEl);
}

function highlightArrondissement(num: number) {
  if (!map) return;

  if (highlightLayer) {
    map.removeLayer(highlightLayer);
    highlightLayer = null;
  }

  const feature = (arrondissementsGeoJson as GeoJSON.FeatureCollection).features.find(
    (f) => f.properties?.c_ar === num,
  );
  if (!feature) return;

  highlightLayer = L.geoJSON(feature as GeoJSON.Feature, {
    style: {
      color: "#2563eb",
      weight: 2.5,
      fillColor: "#3b82f6",
      fillOpacity: 0.25,
    },
  }).addTo(map);

  map.fitBounds(highlightLayer.getBounds(), { padding: [30, 30], maxZoom: 14 });
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

function render() {
  if (!currentStats) return;
  const d = currentStats[currentType];
  titleEl.textContent = currentStats.nom;
  badgeEl.textContent = currentType === "appartements" ? "Appartements" : "Maisons";
  prixMoyenEl.textContent = `${fmt(d.prix_moyen)} \u20AC/m\u00B2`;
  prixMedianEl.textContent = `${fmt(d.prix_median)} \u20AC/m\u00B2`;
  nbVentesEl.textContent = fmt(d.nb_ventes);
}

function setType(type: "appartements" | "maisons") {
  currentType = type;
  btnAppart.classList.toggle("active", type === "appartements");
  btnMaison.classList.toggle("active", type === "maisons");
  render();
}

btnAppart.addEventListener("click", () => setType("appartements"));
btnMaison.addEventListener("click", () => setType("maisons"));

function handleHostContext(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}

const app = new App({ name: "DVF Paris", version: "0.2.0" });

app.onteardown = async () => ({ });

app.ontoolinput = (params) => {
  const args = params.arguments as { arrondissement?: number } | undefined;
  if (args?.arrondissement) {
    titleEl.textContent = `Paris ${args.arrondissement}e...`;
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const stats = result.structuredContent as DvfStats | undefined;
  if (!stats) return;
  currentStats = stats;
  currentType = "appartements";
  btnAppart.classList.add("active");
  btnMaison.classList.remove("active");
  render();
  initMap();
  highlightArrondissement(stats.arrondissement);
};

app.onerror = console.error;
app.onhostcontextchanged = handleHostContext;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);
});

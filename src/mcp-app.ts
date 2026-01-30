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

interface DvfCompareData {
  mode: "compare";
  arrondissement_1: DvfStats;
  arrondissement_2: DvfStats;
}

type ToolResultData = DvfStats | DvfCompareData;

function isCompareData(d: ToolResultData): d is DvfCompareData {
  return (d as DvfCompareData).mode === "compare";
}

const mainEl = document.querySelector(".main") as HTMLElement;
const titleEl = document.getElementById("title")!;
const badgeEl = document.getElementById("badge-type")!;
const statsEl = document.getElementById("stats")!;
const prixMoyenEl = document.getElementById("prix-moyen")!;
const prixMedianEl = document.getElementById("prix-median")!;
const nbVentesEl = document.getElementById("nb-ventes")!;
const btnAppart = document.getElementById("btn-appart")!;
const btnMaison = document.getElementById("btn-maison")!;
const compareSectionEl = document.getElementById("compare-section")!;
const chartContainerEl = document.getElementById("chart-container")!;

let currentStats: DvfStats | null = null;
let compareData: DvfCompareData | null = null;
let isCompareMode = false;
let currentType: "appartements" | "maisons" = "appartements";

let map: L.Map | null = null;
let highlightLayer: L.GeoJSON | null = null;
let highlightLayer2: L.GeoJSON | null = null;

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

function highlightArrondissements(num1: number, num2?: number) {
  if (!map) return;

  if (highlightLayer) {
    map.removeLayer(highlightLayer);
    highlightLayer = null;
  }
  if (highlightLayer2) {
    map.removeLayer(highlightLayer2);
    highlightLayer2 = null;
  }

  const geo = arrondissementsGeoJson as GeoJSON.FeatureCollection;

  const feature1 = geo.features.find((f) => f.properties?.c_ar === num1);
  if (feature1) {
    highlightLayer = L.geoJSON(feature1 as GeoJSON.Feature, {
      style: {
        color: "#2563eb",
        weight: 2.5,
        fillColor: "#3b82f6",
        fillOpacity: 0.25,
      },
    }).addTo(map);
  }

  if (num2 != null) {
    const feature2 = geo.features.find((f) => f.properties?.c_ar === num2);
    if (feature2) {
      highlightLayer2 = L.geoJSON(feature2 as GeoJSON.Feature, {
        style: {
          color: "#d97706",
          weight: 2.5,
          fillColor: "#fbbf24",
          fillOpacity: 0.25,
        },
      }).addTo(map);
    }
  }

  const group = L.featureGroup(
    [highlightLayer, highlightLayer2].filter(Boolean) as L.Layer[],
  );
  if (group.getLayers().length > 0) {
    map.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 14 });
  }
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface BarMetric {
  label: string;
  value1: number;
  value2: number;
  suffix: string;
}

function renderBarChart(
  container: HTMLElement,
  metrics: BarMetric[],
  label1: string,
  label2: string,
) {
  const barH = 18;
  const groupGap = 24;
  const labelH = 16;
  const legendH = 30;
  const paddingTop = legendH + 8;
  const totalH =
    paddingTop + metrics.length * (2 * barH + labelH + groupGap) - groupGap + 8;
  const valueLabelW = 110;
  const chartW = 520;
  const barAreaX = 120;
  const barAreaW = chartW - barAreaX - valueLabelW;

  const maxVal = Math.max(...metrics.flatMap((m) => [m.value1, m.value2]), 1);

  const textColor = "var(--color-text-primary, #1a1a1a)";
  const textSecondary = "var(--color-text-tertiary, #999)";
  const color1 = "#3b82f6";
  const color2 = "#fbbf24";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${chartW} ${totalH}" width="${chartW}" height="${totalH}">`;

  // Legend
  svg += `<rect x="${barAreaX}" y="4" width="12" height="12" rx="2" fill="${color1}"/>`;
  svg += `<text x="${barAreaX + 16}" y="14" font-size="11" fill="${textColor}">${escapeXml(label1)}</text>`;
  const l2x = barAreaX + 20 + label1.length * 6.5;
  svg += `<rect x="${l2x}" y="4" width="12" height="12" rx="2" fill="${color2}"/>`;
  svg += `<text x="${l2x + 16}" y="14" font-size="11" fill="${textColor}">${escapeXml(label2)}</text>`;

  let y = paddingTop;
  for (const m of metrics) {
    // Metric label
    svg += `<text x="0" y="${y + 10}" font-size="11" fill="${textSecondary}">${escapeXml(m.label)}</text>`;
    y += labelH;

    // Bar 1
    const w1 = Math.max((m.value1 / maxVal) * barAreaW, 2);
    svg += `<rect x="${barAreaX}" y="${y}" width="${w1}" height="${barH}" rx="3" fill="${color1}"/>`;
    svg += `<text x="${barAreaX + w1 + 6}" y="${y + 13}" font-size="11" font-weight="600" fill="${textColor}">${escapeXml(fmt(m.value1))}${escapeXml(m.suffix)}</text>`;
    y += barH;

    // Bar 2
    const w2 = Math.max((m.value2 / maxVal) * barAreaW, 2);
    svg += `<rect x="${barAreaX}" y="${y}" width="${w2}" height="${barH}" rx="3" fill="${color2}"/>`;
    svg += `<text x="${barAreaX + w2 + 6}" y="${y + 13}" font-size="11" font-weight="600" fill="${textColor}">${escapeXml(fmt(m.value2))}${escapeXml(m.suffix)}</text>`;
    y += barH + groupGap;
  }

  svg += "</svg>";
  container.innerHTML = svg;
}

function renderSingle() {
  if (!currentStats) return;
  const d = currentStats[currentType];
  titleEl.textContent = currentStats.nom;
  badgeEl.textContent = currentType === "appartements" ? "Appartements" : "Maisons";
  prixMoyenEl.textContent = `${fmt(d.prix_moyen)} \u20AC/m\u00B2`;
  prixMedianEl.textContent = `${fmt(d.prix_median)} \u20AC/m\u00B2`;
  nbVentesEl.textContent = fmt(d.nb_ventes);

  statsEl.style.display = "";
  compareSectionEl.style.display = "none";
  mainEl.classList.remove("compare-mode");
}

function renderCompare() {
  if (!compareData) return;
  const a1 = compareData.arrondissement_1;
  const a2 = compareData.arrondissement_2;

  titleEl.textContent = `${a1.nom} vs ${a2.nom}`;
  badgeEl.textContent = currentType === "appartements" ? "Appartements" : "Maisons";

  // Hide the single-stats row, show chart
  statsEl.style.display = "none";
  compareSectionEl.style.display = "";
  mainEl.classList.add("compare-mode");

  const d1 = a1[currentType];
  const d2 = a2[currentType];

  const metrics: BarMetric[] = [
    { label: "Prix moyen", value1: d1.prix_moyen, value2: d2.prix_moyen, suffix: " \u20AC/m\u00B2" },
    { label: "Prix m\u00E9dian", value1: d1.prix_median, value2: d2.prix_median, suffix: " \u20AC/m\u00B2" },
    { label: "Nb. ventes", value1: d1.nb_ventes, value2: d2.nb_ventes, suffix: "" },
  ];

  renderBarChart(chartContainerEl, metrics, a1.nom, a2.nom);
}

function render() {
  if (isCompareMode) {
    renderCompare();
  } else {
    renderSingle();
  }
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

const app = new App({ name: "DVF Paris", version: "0.4.0" });

app.onteardown = async () => ({});

app.ontoolinput = (params) => {
  const args = params.arguments as
    | { arrondissement?: number; arrondissement_1?: number; arrondissement_2?: number }
    | undefined;
  if (args?.arrondissement_1 && args?.arrondissement_2) {
    titleEl.textContent = `Paris ${args.arrondissement_1}e vs ${args.arrondissement_2}e...`;
  } else if (args?.arrondissement) {
    titleEl.textContent = `Paris ${args.arrondissement}e...`;
  }
};

app.ontoolresult = (result: CallToolResult) => {
  const payload = result.structuredContent as ToolResultData | undefined;
  if (!payload) return;

  currentType = "appartements";
  btnAppart.classList.add("active");
  btnMaison.classList.remove("active");

  if (isCompareData(payload)) {
    isCompareMode = true;
    compareData = payload;
    currentStats = null;
    render();
    initMap();
    highlightArrondissements(
      payload.arrondissement_1.arrondissement,
      payload.arrondissement_2.arrondissement,
    );
  } else {
    isCompareMode = false;
    compareData = null;
    currentStats = payload;
    render();
    initMap();
    highlightArrondissements(payload.arrondissement);
  }
};

app.onerror = console.error;
app.onhostcontextchanged = handleHostContext;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);
});

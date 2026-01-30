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

interface SectionStatsEntry {
  code: string;
  nom: string;
  appartements: { prix_moyen: number; prix_median: number; nb_ventes: number };
  maisons: { prix_moyen: number; prix_median: number; nb_ventes: number };
}

interface SectionsData {
  geojson: GeoJSON.FeatureCollection;
  stats: Record<string, SectionStatsEntry>;
}

interface DvfCompareData {
  mode: "compare";
  arrondissement_1: DvfStats;
  arrondissement_2: DvfStats;
}

interface DvfSingleData extends DvfStats {
  sections?: SectionsData;
}

interface DvfAddressData {
  mode: "address";
  address: {
    label: string;
    lat: number;
    lon: number;
    arrondissement: number;
    section: string | null;
  };
  section: DvfStats | null;
  arrondissement: DvfStats;
  ecart_pct: number | null;
  sections?: SectionsData;
}

type ToolResultData = DvfSingleData | DvfCompareData | DvfAddressData;

function isCompareData(d: ToolResultData): d is DvfCompareData {
  return (d as DvfCompareData).mode === "compare";
}

function isAddressData(d: ToolResultData): d is DvfAddressData {
  return (d as DvfAddressData).mode === "address";
}

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

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
const addressSectionEl = document.getElementById("address-section")!;
const addressLabelEl = document.getElementById("address-label")!;
const addrSectionTitleEl = document.getElementById("addr-section-title")!;
const addrSectionValueEl = document.getElementById("addr-section-value")!;
const addrSectionVentesEl = document.getElementById("addr-section-ventes")!;
const addrArrTitleEl = document.getElementById("addr-arr-title")!;
const addrArrValueEl = document.getElementById("addr-arr-value")!;
const addrArrVentesEl = document.getElementById("addr-arr-ventes")!;
const addressEcartEl = document.getElementById("address-ecart")!;
const sectionInfoEl = document.getElementById("section-info")!;
const sectionInfoTitleEl = document.getElementById("section-info-title")!;
const sectionInfoCloseEl = document.getElementById("section-info-close")!;
const siSectionTitleEl = document.getElementById("si-section-title")!;
const siSectionValueEl = document.getElementById("si-section-value")!;
const siSectionVentesEl = document.getElementById("si-section-ventes")!;
const siArrTitleEl = document.getElementById("si-arr-title")!;
const siArrValueEl = document.getElementById("si-arr-value")!;
const siArrVentesEl = document.getElementById("si-arr-ventes")!;
const siEcartEl = document.getElementById("si-ecart")!;
const mapLegendEl = document.getElementById("map-legend")!;

// Fullscreen + search refs
const btnFullscreen = document.getElementById("btn-fullscreen")! as HTMLButtonElement;
const fullscreenIcon = document.getElementById("fullscreen-icon")!;
const searchBarEl = document.getElementById("search-bar")!;
const searchInputEl = document.getElementById("search-input")! as HTMLInputElement;
const searchBtnEl = document.getElementById("search-btn")! as HTMLButtonElement;
const arrSelectEl = document.getElementById("arr-select")! as HTMLSelectElement;
const loadingOverlayEl = document.getElementById("loading-overlay")!;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentStats: DvfStats | null = null;
let compareData: DvfCompareData | null = null;
let addressData: DvfAddressData | null = null;
let isCompareMode = false;
let isAddressMode = false;
let currentType: "appartements" | "maisons" = "appartements";

let map: L.Map | null = null;
let highlightLayer: L.GeoJSON | null = null;
let highlightLayer2: L.GeoJSON | null = null;
let markerLayer: L.Marker | null = null;
let sectionsLayer: L.GeoJSON | null = null;
let sectionsData: SectionsData | null = null;
let selectedSection: string | null = null;
let arrondissementStats: DvfStats | null = null;

let currentDisplayMode: "inline" | "fullscreen" = "inline";
let isLoading = false;
let canCallServerTools = false;

// ---------------------------------------------------------------------------
// SVG icons for fullscreen toggle
// ---------------------------------------------------------------------------

const ICON_EXPAND = `<polyline points="4,1 1,1 1,4"/><polyline points="12,1 15,1 15,4"/><polyline points="4,15 1,15 1,12"/><polyline points="12,15 15,15 15,12"/>`;
const ICON_COLLAPSE = `<polyline points="1,4 4,4 4,1"/><polyline points="15,4 12,4 12,1"/><polyline points="1,12 4,12 4,15"/><polyline points="15,12 12,12 12,15"/>`;

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------

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

  // Enable scroll zoom in fullscreen
  if (currentDisplayMode === "fullscreen") {
    map.scrollWheelZoom.enable();
    map.zoomControl = L.control.zoom({ position: "topright" });
    map.zoomControl.addTo(map);
  }
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

function clearMarker() {
  if (markerLayer && map) {
    map.removeLayer(markerLayer);
    markerLayer = null;
  }
}

function addMarker(lat: number, lon: number, label: string) {
  if (!map) return;
  clearMarker();

  const icon = L.divIcon({
    className: "",
    html: '<div class="dvf-marker"><div class="dvf-marker-pin"></div></div>',
    iconSize: [24, 34],
    iconAnchor: [12, 34],
    tooltipAnchor: [0, -34],
  });

  markerLayer = L.marker([lat, lon], { icon }).addTo(map);
  markerLayer.bindTooltip(label, {
    permanent: false,
    direction: "top",
    offset: [0, -2],
  });
}

// ---------------------------------------------------------------------------
// Sections choropleth
// ---------------------------------------------------------------------------

function getPriceColor(prix: number): string {
  const min = 8000;
  const max = 25000;
  const t = Math.max(0, Math.min(1, (prix - min) / (max - min)));

  // Green (low) → Yellow → Red (high)
  const r = Math.round(255 * Math.min(1, 2 * t));
  const g = Math.round(255 * Math.min(1, 2 * (1 - t)));
  return `rgb(${r}, ${g}, 0)`;
}

function clearSectionsLayer() {
  if (sectionsLayer && map) {
    map.removeLayer(sectionsLayer);
    sectionsLayer = null;
  }
  sectionsData = null;
  selectedSection = null;
  sectionInfoEl.style.display = "none";
  mapLegendEl.style.display = "none";
}

function renderSectionsLayer(highlightSectionCode?: string | null) {
  if (!map || !sectionsData) return;

  if (sectionsLayer) {
    map.removeLayer(sectionsLayer);
    sectionsLayer = null;
  }

  const geojson = sectionsData.geojson;
  const stats = sectionsData.stats;

  sectionsLayer = L.geoJSON(geojson, {
    style: (feature) => {
      if (!feature || !feature.properties) return {};
      const sectionCode = feature.properties.id as string;
      const sectionStats = stats[sectionCode];
      const prix =
        sectionStats?.[currentType]?.prix_median ?? 0;
      const isHighlighted = sectionCode === highlightSectionCode;
      return {
        fillColor: prix > 0 ? getPriceColor(prix) : "#ccc",
        fillOpacity: prix > 0 ? 0.55 : 0.2,
        color: isHighlighted ? "#2563eb" : "#555",
        weight: isHighlighted ? 3 : 1,
      };
    },
    onEachFeature: (feature, layer) => {
      const sectionCode = feature.properties?.id as string | undefined;
      if (!sectionCode) return;

      layer.on("click", () => {
        selectedSection = sectionCode;
        updateSectionInfo(sectionCode);
        // Re-render to update highlight
        renderSectionsLayer(sectionCode);
      });

      layer.on("mouseover", (e: L.LeafletMouseEvent) => {
        if (sectionCode !== selectedSection) {
          const target = e.target as L.Path;
          target.setStyle({ weight: 2, color: "#333" });
        }
      });

      layer.on("mouseout", (e: L.LeafletMouseEvent) => {
        if (sectionCode !== selectedSection) {
          const target = e.target as L.Path;
          const sectionStats = stats[sectionCode];
          const prix =
            sectionStats?.[currentType]?.prix_median ?? 0;
          target.setStyle({
            weight: 1,
            color: "#555",
            fillColor: prix > 0 ? getPriceColor(prix) : "#ccc",
          });
        }
      });

      // Tooltip with section name + price
      const sectionStats = stats[sectionCode];
      if (sectionStats) {
        const prix = sectionStats[currentType]?.prix_median ?? 0;
        const tooltipText = prix > 0
          ? `${sectionStats.nom} — ${fmt(prix)} \u20AC/m\u00B2`
          : sectionStats.nom;
        layer.bindTooltip(tooltipText, {
          sticky: true,
          direction: "top",
          offset: [0, -10],
        });
      }
    },
  }).addTo(map);

  mapLegendEl.style.display = "";
}

function updateSectionInfo(sectionCode: string) {
  if (!sectionsData || !arrondissementStats) return;

  const secStats = sectionsData.stats[sectionCode];
  if (!secStats) {
    sectionInfoEl.style.display = "none";
    return;
  }

  const secD = secStats[currentType];
  const arrD = arrondissementStats[currentType];

  sectionInfoTitleEl.textContent = secStats.nom;
  siSectionTitleEl.textContent = secStats.nom;
  siSectionValueEl.textContent = `${fmt(secD.prix_median)} \u20AC/m\u00B2`;
  siSectionVentesEl.textContent = `${fmt(secD.nb_ventes)} ventes`;

  siArrTitleEl.textContent = arrondissementStats.nom;
  siArrValueEl.textContent = `${fmt(arrD.prix_median)} \u20AC/m\u00B2`;
  siArrVentesEl.textContent = `${fmt(arrD.nb_ventes)} ventes`;

  let ecart: number | null = null;
  if (secD.prix_median > 0 && arrD.prix_median > 0) {
    ecart = Math.round(
      ((secD.prix_median - arrD.prix_median) / arrD.prix_median) * 100,
    );
  }

  if (ecart != null) {
    const sign = ecart > 0 ? "+" : "";
    siEcartEl.textContent = `${sign}${ecart} %`;
    siEcartEl.className = `address-ecart ${ecart > 0 ? "positive" : ecart < 0 ? "negative" : "neutral"}`;
  } else {
    siEcartEl.textContent = "\u2014";
    siEcartEl.className = "address-ecart neutral";
  }

  sectionInfoEl.style.display = "";
}

sectionInfoCloseEl.addEventListener("click", () => {
  sectionInfoEl.style.display = "none";
  selectedSection = null;
  if (sectionsData) {
    renderSectionsLayer();
  }
});

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Render modes
// ---------------------------------------------------------------------------

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
  addressSectionEl.style.display = "none";
  mainEl.classList.remove("compare-mode");
  mainEl.classList.remove("address-mode");
  clearMarker();

  // Re-render sections choropleth if data available
  if (sectionsData) {
    renderSectionsLayer(selectedSection);
    if (selectedSection) {
      updateSectionInfo(selectedSection);
    }
  }
}

function renderCompare() {
  if (!compareData) return;
  const a1 = compareData.arrondissement_1;
  const a2 = compareData.arrondissement_2;

  titleEl.textContent = `${a1.nom} vs ${a2.nom}`;
  badgeEl.textContent = currentType === "appartements" ? "Appartements" : "Maisons";

  // Hide the single-stats row and address section, show chart
  statsEl.style.display = "none";
  compareSectionEl.style.display = "";
  addressSectionEl.style.display = "none";
  sectionInfoEl.style.display = "none";
  mainEl.classList.add("compare-mode");
  mainEl.classList.remove("address-mode");
  clearMarker();
  clearSectionsLayer();

  const d1 = a1[currentType];
  const d2 = a2[currentType];

  const metrics: BarMetric[] = [
    { label: "Prix moyen", value1: d1.prix_moyen, value2: d2.prix_moyen, suffix: " \u20AC/m\u00B2" },
    { label: "Prix m\u00E9dian", value1: d1.prix_median, value2: d2.prix_median, suffix: " \u20AC/m\u00B2" },
    { label: "Nb. ventes", value1: d1.nb_ventes, value2: d2.nb_ventes, suffix: "" },
  ];

  renderBarChart(chartContainerEl, metrics, a1.nom, a2.nom);
}

function renderAddress() {
  if (!addressData) return;

  const arr = addressData.arrondissement;
  const sec = addressData.section;
  const addr = addressData.address;

  titleEl.textContent = addr.label;
  badgeEl.textContent = currentType === "appartements" ? "Appartements" : "Maisons";

  statsEl.style.display = "none";
  compareSectionEl.style.display = "none";
  addressSectionEl.style.display = "";
  mainEl.classList.remove("compare-mode");
  mainEl.classList.add("address-mode");

  // Re-render sections choropleth if data available
  if (sectionsData) {
    renderSectionsLayer(selectedSection ?? addr.section);
    if (selectedSection) {
      updateSectionInfo(selectedSection);
    }
  }

  const typeData = currentType;

  if (sec) {
    const secD = sec[typeData];
    const arrD = arr[typeData];

    addrSectionTitleEl.textContent = addr.section
      ? `Section ${addr.section.slice(-2)}`
      : "Votre zone";
    addrSectionValueEl.textContent = `${fmt(secD.prix_median)} \u20AC/m\u00B2`;
    addrSectionVentesEl.textContent = `${fmt(secD.nb_ventes)} ventes`;

    addrArrTitleEl.textContent = `${arr.nom}`;
    addrArrValueEl.textContent = `${fmt(arrD.prix_median)} \u20AC/m\u00B2`;
    addrArrVentesEl.textContent = `${fmt(arrD.nb_ventes)} ventes`;

    let ecart: number | null = null;
    if (secD.prix_median > 0 && arrD.prix_median > 0) {
      ecart = Math.round(
        ((secD.prix_median - arrD.prix_median) / arrD.prix_median) * 100,
      );
    }

    if (ecart != null) {
      const sign = ecart > 0 ? "+" : "";
      addressEcartEl.textContent = `${sign}${ecart} %`;
      addressEcartEl.className = `address-ecart ${ecart > 0 ? "positive" : ecart < 0 ? "negative" : "neutral"}`;
    } else {
      addressEcartEl.textContent = "\u2014";
      addressEcartEl.className = "address-ecart neutral";
    }

    addressLabelEl.textContent = `Prix m\u00E9dian ${typeData === "appartements" ? "appartements" : "maisons"}`;
  } else {
    const arrD = arr[typeData];

    addrSectionTitleEl.textContent = "Votre zone";
    addrSectionValueEl.textContent = "N/A";
    addrSectionVentesEl.textContent = "Donn\u00E9es indisponibles";

    addrArrTitleEl.textContent = `${arr.nom}`;
    addrArrValueEl.textContent = `${fmt(arrD.prix_median)} \u20AC/m\u00B2`;
    addrArrVentesEl.textContent = `${fmt(arrD.nb_ventes)} ventes`;

    addressEcartEl.textContent = "\u2014";
    addressEcartEl.className = "address-ecart neutral";

    addressLabelEl.textContent = `Prix m\u00E9dian ${typeData === "appartements" ? "appartements" : "maisons"} (section non disponible)`;
  }
}

function render() {
  if (isAddressMode) {
    renderAddress();
  } else if (isCompareMode) {
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

// ---------------------------------------------------------------------------
// Display mode (fullscreen)
// ---------------------------------------------------------------------------

function updateDisplayMode(mode: "inline" | "fullscreen") {
  currentDisplayMode = mode;

  if (mode === "fullscreen") {
    mainEl.classList.add("fullscreen-mode");
    searchBarEl.style.display = canCallServerTools ? "" : "none";
    fullscreenIcon.innerHTML = ICON_COLLAPSE;
    btnFullscreen.title = "R\u00E9duire";

    // Enable scroll zoom + zoom control in fullscreen
    if (map) {
      map.scrollWheelZoom.enable();
      if (!(map as unknown as Record<string, unknown>)._dvfZoomCtrl) {
        const ctrl = L.control.zoom({ position: "topright" });
        ctrl.addTo(map);
        (map as unknown as Record<string, unknown>)._dvfZoomCtrl = ctrl;
      }
    }
  } else {
    mainEl.classList.remove("fullscreen-mode");
    searchBarEl.style.display = "none";
    fullscreenIcon.innerHTML = ICON_EXPAND;
    btnFullscreen.title = "Plein \u00E9cran";

    // Disable scroll zoom + remove zoom control in inline
    if (map) {
      map.scrollWheelZoom.disable();
      const ctrl = (map as unknown as Record<string, unknown>)._dvfZoomCtrl as L.Control | undefined;
      if (ctrl) {
        map.removeControl(ctrl);
        (map as unknown as Record<string, unknown>)._dvfZoomCtrl = undefined;
      }
    }
  }

  // Invalidate map after CSS transition
  setTimeout(() => {
    map?.invalidateSize();
  }, 350);
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function showLoading() {
  isLoading = true;
  loadingOverlayEl.style.display = "";
  searchBtnEl.disabled = true;
}

function hideLoading() {
  isLoading = false;
  loadingOverlayEl.style.display = "none";
  searchBtnEl.disabled = false;
}

// ---------------------------------------------------------------------------
// Process tool result (shared between ontoolresult and callServerTool)
// ---------------------------------------------------------------------------

function processToolResult(result: CallToolResult) {
  const payload = result.structuredContent as ToolResultData | undefined;
  if (!payload) return;

  hideLoading();

  currentType = "appartements";
  btnAppart.classList.add("active");
  btnMaison.classList.remove("active");

  if (isAddressData(payload)) {
    isAddressMode = true;
    isCompareMode = false;
    addressData = payload;
    compareData = null;
    currentStats = null;
    arrondissementStats = payload.arrondissement;

    clearSectionsLayer();
    if (payload.sections) {
      sectionsData = payload.sections;
    }

    render();
    initMap();
    highlightArrondissements(payload.address.arrondissement);
    addMarker(payload.address.lat, payload.address.lon, payload.address.label);

    if (sectionsData) {
      renderSectionsLayer(payload.address.section);
      if (sectionsLayer) {
        map?.fitBounds(sectionsLayer.getBounds(), { padding: [20, 20] });
      }
    } else {
      map?.setView([payload.address.lat, payload.address.lon], 15);
    }
  } else if (isCompareData(payload)) {
    isCompareMode = true;
    isAddressMode = false;
    compareData = payload;
    currentStats = null;
    addressData = null;
    arrondissementStats = null;
    clearSectionsLayer();
    render();
    initMap();
    highlightArrondissements(
      payload.arrondissement_1.arrondissement,
      payload.arrondissement_2.arrondissement,
    );
  } else {
    isCompareMode = false;
    isAddressMode = false;
    compareData = null;
    addressData = null;
    currentStats = payload;
    arrondissementStats = payload;

    clearSectionsLayer();
    if (payload.sections) {
      sectionsData = payload.sections;
    }

    render();
    initMap();
    highlightArrondissements(payload.arrondissement);

    if (sectionsData) {
      renderSectionsLayer();
      if (sectionsLayer) {
        map?.fitBounds(sectionsLayer.getBounds(), { padding: [20, 20] });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Search from UI (callServerTool)
// ---------------------------------------------------------------------------

async function searchAddress(adresse: string) {
  if (!adresse.trim() || isLoading) return;

  showLoading();
  titleEl.textContent = `Recherche : ${adresse}...`;

  try {
    const result = await app.callServerTool({
      name: "search-dvf-address",
      arguments: { adresse },
    });
    processToolResult(result);
  } catch (error) {
    hideLoading();
    titleEl.textContent = "Erreur de recherche";
    console.error("[DVF] searchAddress error:", error);
  }
}

async function loadArrondissement(arrondissement: number) {
  if (isLoading) return;

  showLoading();
  titleEl.textContent = `Paris ${arrondissement}e...`;

  try {
    const result = await app.callServerTool({
      name: "get-dvf-stats",
      arguments: { arrondissement },
    });
    processToolResult(result);
  } catch (error) {
    hideLoading();
    titleEl.textContent = "Erreur de chargement";
    console.error("[DVF] loadArrondissement error:", error);
  }
}

// ---------------------------------------------------------------------------
// Search bar event listeners
// ---------------------------------------------------------------------------

searchBtnEl.addEventListener("click", () => {
  const val = searchInputEl.value.trim();
  if (val) searchAddress(val);
});

searchInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const val = searchInputEl.value.trim();
    if (val) searchAddress(val);
  }
});

function populateArrSelect() {
  for (let i = 1; i <= 20; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${i}e arr.`;
    arrSelectEl.appendChild(opt);
  }
}

populateArrSelect();

arrSelectEl.addEventListener("change", () => {
  const val = parseInt(arrSelectEl.value, 10);
  if (val >= 1 && val <= 20) {
    loadArrondissement(val);
    arrSelectEl.value = "";
  }
});

// ---------------------------------------------------------------------------
// Fullscreen button
// ---------------------------------------------------------------------------

btnFullscreen.addEventListener("click", async () => {
  const ctx = app.getHostContext();
  const available = ctx?.availableDisplayModes as string[] | undefined;
  if (!available) return;

  const target = currentDisplayMode === "fullscreen" ? "inline" : "fullscreen";
  if (!available.includes(target)) return;

  try {
    const result = await app.requestDisplayMode({ mode: target as "inline" | "fullscreen" });
    updateDisplayMode(result.mode as "inline" | "fullscreen");
  } catch (error) {
    console.error("[DVF] requestDisplayMode error:", error);
  }
});

// ---------------------------------------------------------------------------
// Host context
// ---------------------------------------------------------------------------

function handleHostContext(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
    // Expose bottom inset for fullscreen height calculation
    mainEl.style.setProperty("--safe-area-bottom", `${ctx.safeAreaInsets.bottom}px`);
  }

  // React to display mode changes from host
  const hostMode = ctx.displayMode as "inline" | "fullscreen" | undefined;
  if (hostMode && hostMode !== currentDisplayMode && (hostMode === "inline" || hostMode === "fullscreen")) {
    updateDisplayMode(hostMode);
  }
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = new App(
  { name: "DVF Paris", version: "0.8.0" },
  { availableDisplayModes: ["inline", "fullscreen"] },
);

app.onteardown = async () => ({});

app.ontoolinput = (params) => {
  const args = params.arguments as
    | { arrondissement?: number; arrondissement_1?: number; arrondissement_2?: number; adresse?: string }
    | undefined;
  if (args?.adresse) {
    titleEl.textContent = `Recherche : ${args.adresse}...`;
  } else if (args?.arrondissement_1 && args?.arrondissement_2) {
    titleEl.textContent = `Paris ${args.arrondissement_1}e vs ${args.arrondissement_2}e...`;
  } else if (args?.arrondissement) {
    titleEl.textContent = `Paris ${args.arrondissement}e...`;
  }
};

app.ontoolresult = (result: CallToolResult) => {
  processToolResult(result);
};

app.onerror = console.error;
app.onhostcontextchanged = handleHostContext;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);

  // Show/hide fullscreen button based on host support
  const available = ctx?.availableDisplayModes as string[] | undefined;
  if (available && available.includes("fullscreen")) {
    btnFullscreen.style.display = "";
  }

  // Check serverTools capability
  const caps = app.getHostCapabilities();
  if (caps?.serverTools) {
    canCallServerTools = true;
  }

  // If search bar elements should be disabled without serverTools
  if (!canCallServerTools) {
    searchInputEl.disabled = true;
    searchBtnEl.disabled = true;
    arrSelectEl.disabled = true;
  }

  // Apply initial display mode if already fullscreen
  const initialMode = ctx?.displayMode as "inline" | "fullscreen" | undefined;
  if (initialMode === "fullscreen") {
    updateDisplayMode("fullscreen");
  }
});

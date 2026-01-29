import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./mcp-app.css";

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

const app = new App({ name: "DVF Paris", version: "0.1.0" });

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
};

app.onerror = console.error;
app.onhostcontextchanged = handleHostContext;

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContext(ctx);
});

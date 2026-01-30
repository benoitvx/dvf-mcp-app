import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { fetchDvfStats, type DvfEntry } from "./src/api/data-gouv.js";
import dvfData from "./src/data/dvf-paris.json" with { type: "json" };

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

type DvfCompareResult = {
  mode: "compare";
  arrondissement_1: DvfEntry;
  arrondissement_2: DvfEntry;
};

const fallbackData = dvfData as Record<string, DvfEntry>;

async function getDvfStats(arrondissement: number): Promise<DvfEntry> {
  try {
    return await fetchDvfStats(arrondissement);
  } catch (error) {
    console.warn(
      `[DVF] API failed for arr. ${arrondissement}, fallback:`,
      error instanceof Error ? error.message : error,
    );
    const stats = fallbackData[String(arrondissement)];
    if (!stats) throw new Error(`Arrondissement ${arrondissement} non trouvé`);
    return stats;
  }
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "DVF Paris",
    version: "0.4.0",
  });

  const resourceUri = "ui://dvf/mcp-app.html";

  registerAppTool(
    server,
    "get-dvf-stats",
    {
      title: "Prix immobilier Paris",
      description:
        "Affiche les statistiques DVF (prix au m²) pour un arrondissement parisien",
      inputSchema: {
        arrondissement: z
          .number()
          .min(1)
          .max(20)
          .describe("Numéro d'arrondissement (1-20)"),
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ arrondissement }): Promise<CallToolResult> => {
      try {
        const stats = await getDvfStats(arrondissement);

        return {
          content: [
            {
              type: "text",
              text: `${stats.nom} — Appartements : ${stats.appartements.prix_moyen.toLocaleString("fr-FR")} €/m² (médian ${stats.appartements.prix_median.toLocaleString("fr-FR")} €/m², ${stats.appartements.nb_ventes} ventes). Maisons : ${stats.maisons.prix_moyen.toLocaleString("fr-FR")} €/m² (${stats.maisons.nb_ventes} ventes).`,
            },
          ],
          structuredContent: stats,
        };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `Arrondissement ${arrondissement} non trouvé.`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  registerAppTool(
    server,
    "compare-dvf-stats",
    {
      title: "Comparaison prix immobilier Paris",
      description:
        "Compare les statistiques DVF (prix au m²) entre deux arrondissements parisiens",
      inputSchema: {
        arrondissement_1: z
          .number()
          .min(1)
          .max(20)
          .describe("Premier arrondissement (1-20)"),
        arrondissement_2: z
          .number()
          .min(1)
          .max(20)
          .describe("Second arrondissement (1-20)"),
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ arrondissement_1, arrondissement_2 }): Promise<CallToolResult> => {
      try {
        const [stats1, stats2] = await Promise.all([
          getDvfStats(arrondissement_1),
          getDvfStats(arrondissement_2),
        ]);

        const diff =
          stats1.appartements.prix_moyen - stats2.appartements.prix_moyen;
        const pctDiff = ((diff / stats2.appartements.prix_moyen) * 100).toFixed(
          1,
        );
        const sign = diff > 0 ? "+" : "";

        return {
          content: [
            {
              type: "text",
              text: `Comparaison ${stats1.nom} vs ${stats2.nom} — Appartements : ${stats1.appartements.prix_moyen.toLocaleString("fr-FR")} vs ${stats2.appartements.prix_moyen.toLocaleString("fr-FR")} €/m² (${sign}${pctDiff} %). Maisons : ${stats1.maisons.prix_moyen.toLocaleString("fr-FR")} vs ${stats2.maisons.prix_moyen.toLocaleString("fr-FR")} €/m².`,
            },
          ],
          structuredContent: {
            mode: "compare",
            arrondissement_1: stats1,
            arrondissement_2: stats2,
          } satisfies DvfCompareResult,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Erreur : ${error instanceof Error ? error.message : "Impossible de récupérer les données."}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                csp: {
                  resourceDomains: ["https://*.tile.openstreetmap.org"],
                },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}

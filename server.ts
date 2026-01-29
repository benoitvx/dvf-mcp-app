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

import dvfData from "./src/data/dvf-paris.json" with { type: "json" };

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

type DvfEntry = {
  arrondissement: number;
  nom: string;
  appartements: { prix_moyen: number; prix_median: number; nb_ventes: number };
  maisons: { prix_moyen: number; prix_median: number; nb_ventes: number };
  coords: { lat: number; lon: number };
};

const data = dvfData as Record<string, DvfEntry>;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "DVF Paris",
    version: "0.2.0",
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
      const stats = data[String(arrondissement)];

      if (!stats) {
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

      return {
        content: [
          {
            type: "text",
            text: `${stats.nom} — Appartements : ${stats.appartements.prix_moyen.toLocaleString("fr-FR")} €/m² (médian ${stats.appartements.prix_median.toLocaleString("fr-FR")} €/m², ${stats.appartements.nb_ventes} ventes). Maisons : ${stats.maisons.prix_moyen.toLocaleString("fr-FR")} €/m² (${stats.maisons.nb_ventes} ventes).`,
          },
        ],
        structuredContent: stats,
      };
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

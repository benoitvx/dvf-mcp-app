# DVF Paris - MCP App pour Claude

> POC de MCP App affichant les prix immobiliers parisiens dans Claude

## Objectif

Démontrer une MCP App avec UI interactive dans Claude : l'utilisateur demande "prix de l'immobilier à Paris 11" et obtient un widget avec carte + stats. Il peut aussi comparer 2 arrondissements.

## Stack technique

Basé sur le **MCP Apps SDK officiel** (`@modelcontextprotocol/ext-apps`)

| Composant | Technologie |
|-----------|-------------|
| SDK | `@modelcontextprotocol/ext-apps` |
| MCP Server | `@modelcontextprotocol/sdk` |
| Build | Vite + TypeScript |
| UI | Vanilla JS |
| Carte | Leaflet + OpenStreetMap (pas de token) |
| Charts | SVG pur (pas de dépendance) |
| Transport | stdio (Claude Desktop) ou Streamable HTTP |

## Architecture MCP App

```
┌──────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude              │     │  MCP Server      │     │  UI (iframe)    │
│                      │────▶│  - Tools DVF     │────▶│  - Carte        │
│  "prix Paris 11"     │     │  - Resource HTML │     │  - Stats        │
│  "compare 6e vs 11e" │     │                  │     │  - Bar chart    │
└──────────────────────┘     └──────────────────┘     └─────────────────┘
```

1. Claude appelle le tool `get-dvf-stats` ou `compare-dvf-stats`
2. Le tool retourne les données + référence vers `ui://dvf/mcp-app.html`
3. Claude fetch la resource et l'affiche dans une iframe sandboxée
4. L'UI reçoit les données via `app.ontoolresult` et détecte le mode (single vs compare)

## Structure du projet

```
dvf-mcp-app/
├── server.ts              # MCP Server + Tools + Resource
├── main.ts                # Entry point (stdio + HTTP)
├── mcp-app.html           # Shell HTML pour l'UI
├── src/
│   ├── mcp-app.ts         # UI logic (carte, chart, communication host)
│   ├── mcp-app.css        # Styles widget
│   └── data/
│       ├── dvf-paris.json          # Stats pré-calculées par arrondissement
│       └── arrondissements.geojson.json  # Contours GeoJSON
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── CLAUDE.md
├── BACKLOG.md
└── CHANGELOG.md
```

## Tools MCP

### `get-dvf-stats` — Stats d'un arrondissement

```typescript
registerAppTool(server, "get-dvf-stats", {
  title: "Prix immobilier Paris",
  description: "Affiche les stats DVF pour un arrondissement parisien",
  inputSchema: {
    arrondissement: z.number().min(1).max(20)
  },
  _meta: { ui: { resourceUri } }
}, async ({ arrondissement }) => {
  return {
    content: [{ type: "text", text: `Prix moyen: ...` }],
    structuredContent: stats
  };
});
```

### `compare-dvf-stats` — Comparaison de 2 arrondissements

```typescript
registerAppTool(server, "compare-dvf-stats", {
  title: "Comparaison prix immobilier Paris",
  description: "Compare les stats DVF entre deux arrondissements parisiens",
  inputSchema: {
    arrondissement_1: z.number().min(1).max(20),
    arrondissement_2: z.number().min(1).max(20)
  },
  _meta: { ui: { resourceUri } }
}, async ({ arrondissement_1, arrondissement_2 }) => {
  return {
    content: [{ type: "text", text: `Comparaison ...` }],
    structuredContent: { mode: "compare", arrondissement_1: stats1, arrondissement_2: stats2 }
  };
});
```

## Données DVF

JSON statique pré-calculé (source: data.gouv.fr DVF géolocalisées).

Structure de `src/data/dvf-paris.json` :

```json
{
  "11": {
    "arrondissement": 11,
    "nom": "Paris 11e",
    "appartements": {
      "prix_moyen": 10200,
      "prix_median": 9900,
      "nb_ventes": 1245
    },
    "maisons": {
      "prix_moyen": 11800,
      "prix_median": 11200,
      "nb_ventes": 15
    },
    "coords": { "lat": 48.8592, "lon": 2.3806 }
  }
}
```

## Configuration Claude Desktop

Ajouter dans `~/Library/Application Support/Claude/claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "dvf-paris": {
      "command": "bash",
      "args": ["-c", "cd /chemin/vers/dvf-mcp-app && npx tsx main.ts --stdio"]
    }
  }
}
```

Après modification, redémarrer Claude Desktop (Cmd+Q puis rouvrir).

## Commandes

```bash
# Dev (watch mode)
npm run dev

# Build
npm run build

# Lancer le serveur (Streamable HTTP sur port 3001)
npm run serve
```

## UI — Modes de rendu

L'UI (`mcp-app.ts`) détecte le mode via `structuredContent` :

- **Mode single** (`DvfStats`) : carte avec 1 arrondissement bleu, grille de stats, widget 380px
- **Mode compare** (`{ mode: "compare", ... }`) : carte avec 2 arrondissements (bleu + orange), bar chart SVG 3 métriques, widget 520px

Le toggle Appartements/Maisons met à jour les stats ou le chart selon le mode actif.

## Conventions

### Commits
- ✨ Nouvelle feature
- 🐛 Bugfix
- 🎨 UI/Style
- 📝 Documentation
- 🚀 Deploy

## Ressources

- [MCP Apps Docs](https://modelcontextprotocol.io/docs/extensions/apps)
- [ext-apps GitHub](https://github.com/modelcontextprotocol/ext-apps)
- [map-server example](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/map-server)
- [Quickstart](https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html)
- [Skill create-mcp-app](https://github.com/modelcontextprotocol/ext-apps/blob/main/plugins/mcp-apps/skills/create-mcp-app/SKILL.md) — utilisé pour le scaffold initial

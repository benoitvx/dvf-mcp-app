# DVF Paris - MCP App pour Claude

> POC de MCP App affichant les prix immobiliers parisiens dans Claude

## Objectif

Démontrer une MCP App avec UI interactive dans Claude : l'utilisateur demande "prix de l'immobilier à Paris 11" et obtient un widget avec carte + stats.

## Stack technique

Basé sur le **MCP Apps SDK officiel** (`@modelcontextprotocol/ext-apps`)

| Composant | Technologie |
|-----------|-------------|
| SDK | `@modelcontextprotocol/ext-apps` |
| MCP Server | `@modelcontextprotocol/sdk` |
| Build | Vite + TypeScript |
| UI | React ou vanilla JS |
| Carte | Leaflet + OpenStreetMap (pas de token) |
| Transport | stdio (Claude Desktop) ou Streamable HTTP |

## Architecture MCP App

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude         │     │  MCP Server      │     │  UI (iframe)    │
│                 │────▶│  - Tool DVF      │────▶│  - Carte        │
│  "prix Paris 11"│     │  - Resource HTML │     │  - Stats        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

1. Claude appelle le tool `get-dvf-stats`
2. Le tool retourne les données + référence vers `ui://dvf/mcp-app.html`
3. Claude fetch la resource et l'affiche dans une iframe sandboxée
4. L'UI reçoit les données via `app.ontoolresult`

## Setup initial

Utiliser le **skill `create-mcp-app`** installé dans Claude Code.

**Prompt pour Claude Code** :
```
Crée une MCP App "dvf-paris" qui affiche les prix immobiliers par arrondissement parisien.

Tool : get-dvf-stats
- Input : arrondissement (1-20)
- Output : prix moyen, prix médian, nb ventes

UI : Widget affichant les stats avec style sobre

Génère aussi le fichier dvf-paris.json avec les données réelles des 20 arrondissements parisiens (utilise les données DVF de data.gouv.fr).
```

Le skill va :
1. Scaffolder la structure du projet
2. Configurer Vite + TypeScript
3. Créer le tool MCP avec UI resource
4. Générer le shell HTML + mcp-app.ts

Ensuite :
```bash
cd dvf-paris
git init
git add .
git commit -m "🎉 init: scaffold MCP App DVF Paris"
```

## Structure du projet

```
dvf-paris-mcp-app/
├── src/
│   ├── server.ts          # MCP Server + Tool + Resource
│   ├── mcp-app.ts         # UI logic (communique avec host)
│   └── data/
│       └── dvf-paris.json # Stats pré-calculées par arrondissement
├── mcp-app.html           # Shell HTML pour l'UI
├── main.ts                # Entry point (stdio + HTTP)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CLAUDE.md
├── BACKLOG.md
└── CHANGELOG.md
```

## Données DVF

JSON statique pré-calculé par Claude Code (source: data.gouv.fr DVF géolocalisées)

**Claude Code doit générer `src/data/dvf-paris.json`** avec les stats réelles des 20 arrondissements parisiens en se basant sur les données DVF disponibles sur data.gouv.fr.

Structure attendue :

```json
{
  "11": {
    "arrondissement": 11,
    "nom": "Paris 11ème",
    "appartements": {
      "prix_moyen": 10500,
      "prix_median": 10200,
      "nb_ventes": 1842
    },
    "maisons": {
      "prix_moyen": 12000,
      "prix_median": 11500,
      "nb_ventes": 23
    },
    "coords": { "lat": 48.8592, "lon": 2.3806 }
  }
}
```

## Tool MCP

```typescript
registerAppTool(server, "get-dvf-stats", {
  title: "Prix immobilier Paris",
  description: "Affiche les stats DVF pour un arrondissement parisien",
  inputSchema: {
    arrondissement: z.number().min(1).max(20).describe("Numéro d'arrondissement (1-20)")
  },
  _meta: { ui: { resourceUri: "ui://dvf/mcp-app.html" } }
}, async ({ arrondissement }) => {
  const stats = dvfData[arrondissement];
  return {
    content: [{ type: "text", text: `Prix moyen: ${stats.appartements.prix_moyen}€/m²` }],
    structuredContent: stats  // Passé à l'UI
  };
});
```

## Configuration Claude Desktop

```json
{
  "mcpServers": {
    "dvf-paris": {
      "command": "bash",
      "args": ["-c", "cd ~/Dev/dvf-paris-mcp-app && npm run build >&2 && node dist/main.js --stdio"]
    }
  }
}
```

## Commandes

```bash
# Dev (watch mode)
npm run dev

# Build
npm run build

# Test avec Claude Desktop
# Ajouter la config dans ~/Library/Application Support/Claude/claude_desktop_config.json
```

## Conventions

### Commits
- ✨ Nouvelle feature
- 🐛 Bugfix  
- 🎨 UI/Style
- 📝 Documentation
- 🚀 Deploy

## Ressources

- **[Skill create-mcp-app](https://github.com/modelcontextprotocol/ext-apps/blob/main/plugins/mcp-apps/skills/create-mcp-app/SKILL.md)** ← utilisé pour scaffolder
- [MCP Apps Docs](https://modelcontextprotocol.io/docs/extensions/apps)
- [ext-apps GitHub](https://github.com/modelcontextprotocol/ext-apps)
- [map-server example](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/map-server)
- [Quickstart](https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html)

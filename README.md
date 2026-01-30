# DVF Paris — MCP App

An interactive MCP App that displays Paris real estate prices per arrondissement, directly inside Claude.

Built with the [MCP Apps SDK](https://github.com/modelcontextprotocol/ext-apps) (`@modelcontextprotocol/ext-apps`).

## What it does

Ask Claude about Paris real estate prices and get an interactive widget with:

- **Interactive map** (Leaflet + OpenStreetMap) highlighting the arrondissement
- **Choropleth sections** (v0.6): cadastral sections colored by median price, clickable for details
- **Price stats**: average price/m², median price/m², number of sales
- **Apartments / Houses toggle**
- **Comparison mode**: compare two arrondissements side-by-side with a bar chart
- **Address search** (v0.5): search by address and get stats for the cadastral section

Data source: [DVF (Demandes de Valeurs Foncieres)](https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres-geolocalisees/) from data.gouv.fr.

## Architecture

```
Claude                    MCP Server               UI (iframe)
  │                          │                         │
  │── "prix Paris 11" ──────>│                         │
  │                          │── get-dvf-stats ───────>│
  │                          │   structuredContent     │── Map + Stats
  │                          │                         │
  │── "compare 6e vs 11e" ──>│                         │
  │                          │── compare-dvf-stats ───>│
  │                          │   mode: "compare"       │── Map + Bar chart
  │                          │                         │
  │── "prix rue Roquette" ──>│                         │
  │                          │── search-dvf-address ──>│
  │                          │   mode: "address"       │── Map + Marker + Compare
```

1. Claude calls `get-dvf-stats`, `compare-dvf-stats` or `search-dvf-address`
2. The tool returns data + a reference to `ui://dvf/mcp-app.html`
3. Claude fetches the resource and displays it in a sandboxed iframe
4. The UI receives data via `app.ontoolresult`

## MCP Tools

| Tool | Input | Output |
|------|-------|--------|
| `get-dvf-stats` | `arrondissement` (1-20) | Price stats for one arrondissement |
| `compare-dvf-stats` | `arrondissement_1`, `arrondissement_2` (1-20) | Side-by-side comparison with bar chart |
| `search-dvf-address` | `adresse` (string) | Stats for cadastral section + comparison with arrondissement |

## Stack

| Component | Technology |
|-----------|------------|
| MCP Apps SDK | `@modelcontextprotocol/ext-apps` |
| MCP Server | `@modelcontextprotocol/sdk` |
| Build | Vite + TypeScript |
| UI | Vanilla JS |
| Map | Leaflet + OpenStreetMap (no API key needed) |
| Charts | Pure SVG (no dependencies) |
| Transport | stdio (Claude Desktop) or Streamable HTTP |

## External APIs

| API | Usage |
|-----|-------|
| [MCP data.gouv](https://www.data.gouv.fr/datasets/statistiques-dvf/) | Real-time DVF stats |
| [API Géoplateforme](https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage) | Address geocoding |
| [cadastre.data.gouv.fr](https://cadastre.data.gouv.fr/) | Cadastral section geometries (GeoJSON) |

## Setup

```bash
npm install
npm run build
```

## Claude Desktop configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dvf-paris": {
      "command": "bash",
      "args": ["-c", "cd /path/to/dvf-mcp-app && npx tsx main.ts --stdio"]
    }
  }
}
```

Then restart Claude Desktop.

## Development

```bash
# Watch mode (UI hot reload + server)
npm run dev

# Build only
npm run build

# Run server (Streamable HTTP on port 3001)
npm run serve
```

## Project structure

```
dvf-mcp-app/
├── server.ts              # MCP Server + Tools + Resource
├── main.ts                # Entry point (stdio + HTTP)
├── mcp-app.html           # UI shell (HTML)
├── src/
│   ├── mcp-app.ts         # UI logic (map, chart, host communication)
│   ├── mcp-app.css        # Widget styles
│   ├── api/               # External API clients
│   │   ├── cadastre.ts    # Cadastre GeoJSON client
│   │   ├── data-gouv.ts   # MCP data.gouv client
│   │   └── geoplateforme.ts # Geocoding client
│   └── data/
│       ├── dvf-paris.json          # Pre-computed stats (fallback)
│       └── arrondissements.geojson.json  # GeoJSON boundaries
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Roadmap

- [x] **v0.1** — Basic stats widget
- [x] **v0.2** — Interactive map with Leaflet
- [x] **v0.3** — Comparison mode (2 arrondissements)
- [x] **v0.4** — Real-time data via data.gouv.fr API (with JSON fallback)
- [x] **v0.5** — Address search with cadastral section stats
- [x] **v0.6** — Choropleth cadastral sections (clickable, color-coded by price)
- [ ] **v0.7** — Link to recent transactions (optional)
- [ ] **v0.8** — Full-screen mode (optional)

## License

MIT

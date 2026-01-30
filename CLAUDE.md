# DVF Paris - MCP App pour Claude

> POC de MCP App affichant les prix immobiliers parisiens dans Claude

## Objectif

Démontrer une MCP App avec UI interactive dans Claude : l'utilisateur demande "prix de l'immobilier à Paris 11" et obtient un widget avec carte + stats. Il peut aussi comparer 2 arrondissements ou rechercher par adresse.

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
│  "prix rue Roquette" │     │                  │     │  - Marker       │
└──────────────────────┘     └──────────────────┘     └─────────────────┘
```

1. Claude appelle le tool `get-dvf-stats`, `compare-dvf-stats` ou `search-dvf-address`
2. Le tool retourne les données + référence vers `ui://dvf/mcp-app.html`
3. Claude fetch la resource et l'affiche dans une iframe sandboxée
4. L'UI reçoit les données via `app.ontoolresult` et détecte le mode (single vs compare vs address)

## Structure du projet

```
dvf-mcp-app/
├── server.ts              # MCP Server + Tools + Resource
├── main.ts                # Entry point (stdio + HTTP)
├── mcp-app.html           # Shell HTML pour l'UI
├── src/
│   ├── mcp-app.ts         # UI logic (carte, chart, communication host)
│   ├── mcp-app.css        # Styles widget
│   ├── api/               # (v0.4+) Clients API externes
│   │   ├── data-gouv.ts   # Client MCP data.gouv
│   │   └── geoplateforme.ts # Client API Géoplateforme (géocodage)
│   └── data/
│       ├── dvf-paris.json          # (deprecated v0.4) Stats pré-calculées
│       └── arrondissements.geojson.json  # Contours GeoJSON
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── CLAUDE.md
├── BACKLOG.md
└── CHANGELOG.md
```

---

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
  // v0.4+ : appel MCP data.gouv au lieu du JSON statique
  const stats = await fetchDvfStats(arrondissement);
  return {
    content: [{ type: "text", text: `Prix moyen: ${stats.appartements.prix_moyen}€/m²` }],
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

### `search-dvf-address` — Recherche par adresse (v0.5)

```typescript
registerAppTool(server, "search-dvf-address", {
  title: "Prix immobilier par adresse",
  description: "Recherche les stats DVF pour une adresse parisienne. Retourne les stats de la section cadastrale + comparaison avec l'arrondissement.",
  inputSchema: {
    adresse: z.string().describe("Adresse à Paris (ex: '45 avenue de la Motte-Picquet Paris 7')")
  },
  _meta: { ui: { resourceUri } }
}, async ({ adresse }) => {
  // 1. Géocodage via API Géoplateforme
  const geo = await geocodeAddress(adresse);
  
  // 2. Stats de la section cadastrale via MCP data.gouv
  const sectionStats = await fetchDvfStatsBySection(geo.section);
  
  // 3. Stats de l'arrondissement pour comparaison
  const arrStats = await fetchDvfStats(geo.arrondissement);
  
  return {
    content: [{ type: "text", text: `${geo.label}: ${sectionStats.appartements.prix_median}€/m² (${diff}% vs ${geo.arrondissement}e)` }],
    structuredContent: {
      mode: "address",
      address: geo,
      section: sectionStats,
      arrondissement: arrStats
    }
  };
});
```

---

## APIs externes

### MCP data.gouv — Stats DVF temps réel (v0.4+)

Dataset : **Statistiques DVF** (`64998de5926530ebcecc7b15`)
Resource : `851d342f-9c96-41c1-924a-11a7a7aae8a6`

**Colonnes disponibles** :
| Colonne | Description |
|---------|-------------|
| `code_geo` | Code INSEE (75111) ou section cadastrale (75111000AA) |
| `libelle_geo` | "Paris 11e Arrondissement" ou code section |
| `echelle_geo` | "commune" ou "section" |
| `code_parent` | Code de l'arrondissement parent (pour les sections) |
| `nb_ventes_whole_appartement` | Nombre de ventes appartements |
| `moy_prix_m2_whole_appartement` | Prix moyen €/m² appartements |
| `med_prix_m2_whole_appartement` | Prix médian €/m² appartements |
| `nb_ventes_whole_maison` | Nombre de ventes maisons |
| `moy_prix_m2_whole_maison` | Prix moyen €/m² maisons |
| `med_prix_m2_whole_maison` | Prix médian €/m² maisons |

**Exemples de requêtes** :

```typescript
// Stats Paris 11e (arrondissement)
await mcpDataGouv.queryResourceData({
  resource_id: "851d342f-9c96-41c1-924a-11a7a7aae8a6",
  filter_column: "code_geo",
  filter_value: "75111",
  filter_operator: "exact"
});
// → 1 résultat : stats de l'arrondissement

// Stats par section cadastrale du 11e
await mcpDataGouv.queryResourceData({
  resource_id: "851d342f-9c96-41c1-924a-11a7a7aae8a6",
  filter_column: "code_parent",
  filter_value: "75111",
  filter_operator: "exact"
});
// → ~60 résultats : toutes les sections du 11e

// Stats d'une section spécifique
await mcpDataGouv.queryResourceData({
  resource_id: "851d342f-9c96-41c1-924a-11a7a7aae8a6",
  filter_column: "code_geo",
  filter_value: "75107000AK",
  filter_operator: "exact"
});
// → 1 résultat : stats de la section AK du 7e
```

**Mapping vers le format interne** :

```typescript
interface DvfStats {
  arrondissement: number;
  nom: string;
  appartements: {
    prix_moyen: number;
    prix_median: number;
    nb_ventes: number;
  };
  maisons: {
    prix_moyen: number;
    prix_median: number;
    nb_ventes: number;
  };
  coords: { lat: number; lon: number };
}

function mapApiToDvfStats(row: ApiRow, arrNum: number): DvfStats {
  return {
    arrondissement: arrNum,
    nom: row.libelle_geo,
    appartements: {
      prix_moyen: row.moy_prix_m2_whole_appartement || 0,
      prix_median: row.med_prix_m2_whole_appartement || 0,
      nb_ventes: row.nb_ventes_whole_appartement || 0
    },
    maisons: {
      prix_moyen: row.moy_prix_m2_whole_maison || 0,
      prix_median: row.med_prix_m2_whole_maison || 0,
      nb_ventes: row.nb_ventes_whole_maison || 0
    },
    coords: ARRONDISSEMENT_COORDS[arrNum] // garder les coords en local
  };
}
```

### API Géoplateforme — Géocodage (v0.5)

> ⚠️ L'ancienne API `api-adresse.data.gouv.fr` est dépréciée (fin janvier 2026). Utiliser la nouvelle API Géoplateforme.

**Endpoint géocodage direct** :
```
GET https://data.geopf.fr/geocodage/search?q={adresse}&limit=1
```

**Réponse** :
```json
{
  "features": [{
    "properties": {
      "label": "45 Avenue de la Motte-Picquet 75007 Paris",
      "housenumber": "45",
      "street": "Avenue de la Motte-Picquet",
      "postcode": "75007",
      "citycode": "75107",
      "city": "Paris"
    },
    "geometry": {
      "type": "Point",
      "coordinates": [2.3065, 48.8503]
    }
  }]
}
```

**Endpoint reverse geocoding (parcelles)** :
```
GET https://data.geopf.fr/geocodage/reverse?lon={lon}&lat={lat}&index=parcel
```

**Flow complet adresse → section** :

```typescript
async function geocodeAddress(adresse: string): Promise<GeoResult> {
  // 1. Géocodage direct
  const searchRes = await fetch(
    `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(adresse)}&limit=1`
  );
  const searchData = await searchRes.json();
  const feature = searchData.features[0];
  
  const { citycode, label } = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  
  // 2. Reverse geocoding pour obtenir la parcelle
  const reverseRes = await fetch(
    `https://data.geopf.fr/geocodage/reverse?lon=${lon}&lat=${lat}&index=parcel`
  );
  const reverseData = await reverseRes.json();
  
  // 3. Extraire la section (8 premiers caractères de l'ID parcelle)
  // Ex: "75107000AK0012" → "75107000AK"
  const parcelId = reverseData.features[0]?.properties?.id;
  const section = parcelId ? parcelId.substring(0, 10) : null;
  
  return {
    label,
    lat,
    lon,
    citycode,
    arrondissement: parseInt(citycode.substring(3)), // 75107 → 7
    section
  };
}
```

---

## Données DVF

### v0.1-v0.3 : JSON statique (deprecated)

Le fichier `src/data/dvf-paris.json` contient les stats pré-calculées. **Gardé comme fallback** si l'API est indisponible.

### v0.4+ : API temps réel

Les données viennent du MCP data.gouv. Le JSON statique sert de cache/fallback.

**Granularité disponible** :
| Niveau | Code exemple | Nb zones Paris |
|--------|--------------|----------------|
| Arrondissement | `75111` | 20 |
| Section cadastrale | `75111000AA` | ~1000 |

---

## UI — Modes de rendu

L'UI (`mcp-app.ts`) détecte le mode via `structuredContent` :

### Mode `single` (v0.1+)
- Carte avec 1 arrondissement en surbrillance (bleu)
- Grille de stats : prix moyen, médian, nb ventes
- Widget 380px

### Mode `compare` (v0.3+)
- Carte avec 2 arrondissements (bleu + orange)
- Bar chart SVG 3 métriques
- Widget 520px

### Mode `address` (v0.5+)
- Carte centrée sur l'adresse avec marker
- Section cadastrale en surbrillance
- Stats comparées : section vs arrondissement
- Indicateur écart en % ("+28% vs 7e")
- Widget 450px

### Mode `sections` (v0.6+)
- Carte avec toutes les sections de l'arrondissement
- Sections colorées selon prix médian (choropleth)
- Clic sur section → affiche stats dans panneau info
- Légende de l'échelle de prix

```typescript
// Détection du mode dans mcp-app.ts
app.ontoolresult = (result) => {
  const data = result.structuredContent;
  
  if (data.mode === "compare") {
    renderCompare(data);
  } else if (data.mode === "address") {
    renderAddress(data);
  } else {
    renderSingle(data);
  }
  
  // Si sections disponibles, ajouter le layer cliquable
  if (data.sections) {
    renderSectionsLayer(data.sections.geojson, data.sections.stats);
  }
};
```

---

## API Cadastre — Sections GeoJSON (v0.6+)

**Endpoint** :
```
GET https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/{code_insee}/geojson/sections
```

**Exemple Paris 7e** :
```
GET https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/75107/geojson/sections
```

**Réponse** (GeoJSON FeatureCollection) :
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "75107000AK",
        "commune": "75107",
        "prefixe": "000",
        "code": "AK"
      },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [...]
      }
    }
  ]
}
```

**Jointure avec stats DVF** :
```typescript
// 1. Charger les géométries
const geoRes = await fetch(
  `https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/75107/geojson/sections`
);
const sectionsGeoJSON = await geoRes.json();

// 2. Charger les stats (MCP data.gouv)
const statsRes = await mcpDataGouv.queryResourceData({
  resource_id: "851d342f-9c96-41c1-924a-11a7a7aae8a6",
  filter_column: "code_parent",
  filter_value: "75107",
  page_size: 100
});

// 3. Créer un Map pour lookup rapide
const statsMap = new Map<string, DvfStats>();
for (const row of statsRes.data) {
  statsMap.set(row.code_geo, mapApiToDvfStats(row));
}

// 4. Enrichir le GeoJSON avec les stats
for (const feature of sectionsGeoJSON.features) {
  const stats = statsMap.get(feature.properties.id);
  if (stats) {
    feature.properties.prix_median = stats.appartements.prix_median;
    feature.properties.nb_ventes = stats.appartements.nb_ventes;
  }
}
```

**Choropleth Leaflet** :
```typescript
function renderSectionsLayer(geojson: GeoJSON, statsMap: Map<string, DvfStats>) {
  const layer = L.geoJSON(geojson, {
    style: (feature) => {
      const prix = feature.properties.prix_median || 0;
      return {
        fillColor: getPriceColor(prix),
        fillOpacity: 0.6,
        color: '#333',
        weight: 1
      };
    },
    onEachFeature: (feature, layer) => {
      layer.on('click', () => {
        const stats = statsMap.get(feature.properties.id);
        showInfoPanel(stats);
      });
    }
  });
  
  layer.addTo(map);
}

function getPriceColor(prix: number): string {
  // Échelle Paris : 8000 → 25000 €/m²
  const min = 8000, max = 25000;
  const t = Math.max(0, Math.min(1, (prix - min) / (max - min)));
  
  // Vert (bas) → Jaune → Rouge (haut)
  const r = Math.round(255 * Math.min(1, 2 * t));
  const g = Math.round(255 * Math.min(1, 2 * (1 - t)));
  return `rgb(${r}, ${g}, 0)`;
}
```

---

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

## Conventions

### Commits
- ✨ Nouvelle feature
- 🐛 Bugfix
- 🎨 UI/Style
- 📝 Documentation
- 🚀 Deploy
- ♻️ Refactor

## Ressources

- [MCP Apps Docs](https://modelcontextprotocol.io/docs/extensions/apps)
- [ext-apps GitHub](https://github.com/modelcontextprotocol/ext-apps)
- [map-server example](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/map-server)
- [Quickstart](https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html)
- [Skill create-mcp-app](https://github.com/modelcontextprotocol/ext-apps/blob/main/plugins/mcp-apps/skills/create-mcp-app/SKILL.md)

### APIs
- [MCP data.gouv - Statistiques DVF](https://www.data.gouv.fr/datasets/statistiques-dvf/)
- [API Géoplateforme - Géocodage](https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage)
- [cadastre.data.gouv.fr](https://cadastre.data.gouv.fr/) — Sections et parcelles GeoJSON
- [API Cadastre - Bundler](https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/{code}/geojson/sections)

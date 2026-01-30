# DVF Paris - Backlog

> De POC à App interactive avec données temps réel

## MVP (v0.1) — Widget stats DVF ✅

**Objectif** : Prompt "prix immobilier Paris 11" → widget avec stats

### Setup (via skill `create-mcp-app`)
- [x] Demander à Claude Code de scaffolder le projet avec le skill
- [x] Claude Code génère `dvf-paris.json` avec stats des 20 arrondissements (depuis data.gouv.fr)
- [x] Init Git + premier commit

### MCP Server
- [x] Tool `get-dvf-stats` avec input `arrondissement` (1-20)
- [x] Resource `ui://dvf/mcp-app.html`
- [x] Retourner `structuredContent` avec les stats

### UI Widget
- [x] Shell HTML + mcp-app.ts
- [x] Afficher : arrondissement, prix moyen, prix médian, nb ventes
- [x] Style minimal — CSS variables du host + toggle Apparts/Maisons

### Test
- [x] Config Claude Desktop (stdio)
- [x] Test prompt "prix Paris 11"
- [x] Vérifier que le widget s'affiche

---

## v0.2 — Carte interactive ✅

- [x] Intégrer Leaflet + OpenStreetMap
- [x] Centrer sur l'arrondissement demandé
- [x] Afficher les limites de l'arrondissement
- [x] Testé sur claude.ai (Streamable HTTP + ngrok)

---

## v0.3 — Comparaison ✅

- [x] Tool `compare-dvf-stats` avec inputs `arrondissement_1` et `arrondissement_2`
- [x] Bar chart SVG pur (3 métriques groupées, légende colorée)
- [x] Carte : 2 arrondissements en surbrillance (bleu + orange)
- [x] Widget 520px en mode comparaison (380px en single)
- [x] Détection automatique du mode via `structuredContent.mode`
- [x] Toggle Apparts/Maisons met à jour le chart
- [x] Fix labels tronqués dans le bar chart SVG
- [x] Testé sur claude.ai (Claude Desktop)
- [x] Repo GitHub créé + README anglais

---

## v0.4 — Données temps réel ✅

**Objectif** : Remplacer le JSON statique par des appels temps réel au MCP data.gouv

### Source de données

- **Dataset** : Statistiques DVF
- **Dataset ID** : `64998de5926530ebcecc7b15`
- **Resource ID** : `851d342f-9c96-41c1-924a-11a7a7aae8a6`
- **413K lignes** : arrondissements + sections cadastrales de toute la France

### Tasks

- [x] Créer `src/api/data-gouv.ts` — client pour requêter le MCP data.gouv
  ```typescript
  // Fonction pour récupérer les stats d'un arrondissement
  async function fetchDvfStats(arrondissement: number): Promise<DvfStats>
  
  // Fonction pour récupérer les stats d'une section
  async function fetchDvfStatsBySection(sectionCode: string): Promise<DvfStats>
  ```

- [x] Refactor `get-dvf-stats` dans `server.ts`
  - Appeler `fetchDvfStats(arrondissement)` au lieu de lire le JSON
  - Filtrer par `code_geo` = `751XX` (ex: `75111` pour le 11e)
  - Mapper les colonnes API vers le format `DvfStats`

- [x] Refactor `compare-dvf-stats`
  - Même logique, 2 appels parallèles

- [x] Garder `dvf-paris.json` comme fallback
  - Si l'API échoue → utiliser le JSON statique
  - Log warning "Fallback to static data"

- [ ] Ajouter loading state dans l'UI
  - Skeleton screen pendant l'appel API
  - Indicateur si données viennent du cache

- [ ] Tester les perfs
  - Mesurer latence API vs JSON local
  - Vérifier que ça reste < 2s

### Mapping colonnes API → format interne

| API | Interne |
|-----|---------|
| `moy_prix_m2_whole_appartement` | `appartements.prix_moyen` |
| `med_prix_m2_whole_appartement` | `appartements.prix_median` |
| `nb_ventes_whole_appartement` | `appartements.nb_ventes` |
| `moy_prix_m2_whole_maison` | `maisons.prix_moyen` |
| `med_prix_m2_whole_maison` | `maisons.prix_median` |
| `nb_ventes_whole_maison` | `maisons.nb_ventes` |

### Test

- [ ] Prompt "prix Paris 11" → vérifier que les données viennent de l'API
- [ ] Couper le réseau → vérifier fallback JSON
- [ ] Comparer les valeurs API vs JSON (doivent être proches)


---

## v0.5 — Recherche par adresse ✅

**Objectif** : L'utilisateur saisit une adresse → stats DVF de la zone (section cadastrale)

### Flow

```
"45 avenue de la Motte-Picquet Paris 7"
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  1. Géocodage (API Géoplateforme)                   │
│     → lat: 48.8503, lon: 2.3065                     │
│     → citycode: 75107 (Paris 7e)                    │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  2. Reverse geocoding parcelle                       │
│     → parcelle: 75107000AK0012                      │
│     → section: 75107000AK                           │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  3. Stats DVF (MCP data.gouv)                       │
│     Section 75107000AK:                             │
│       • Prix médian: 18 681 €/m²                    │
│       • Nb ventes: 54                               │
│     Arrondissement 75107:                           │
│       • Prix médian: 14 400 €/m²                    │
│     → Écart: +28%                                   │
└─────────────────────────────────────────────────────┘
```

### API Géoplateforme

> ⚠️ L'ancienne API `api-adresse.data.gouv.fr` est dépréciée (fin janvier 2026)

**Géocodage direct** :
```
GET https://data.geopf.fr/geocodage/search?q=45+avenue+motte+picquet+paris&limit=1
```

**Reverse geocoding parcelle** :
```
GET https://data.geopf.fr/geocodage/reverse?lon=2.3065&lat=48.8503&index=parcel
```

### Tasks

- [x] Créer `src/api/geoplateforme.ts` — client géocodage
  ```typescript
  interface GeoResult {
    label: string;           // "45 Avenue de la Motte-Picquet 75007 Paris"
    lat: number;
    lon: number;
    citycode: string;        // "75107"
    arrondissement: number;  // 7
    section: string | null;  // "75107000AK"
  }

  async function geocodeAddress(adresse: string): Promise<GeoResult>
  ```

- [x] Nouveau tool `search-dvf-address` dans `server.ts`
  - Input : `adresse` (string)
  - Appeler `geocodeAddress(adresse)`
  - Appeler `fetchDvfStatsBySection(section)` si section trouvée
  - Appeler `fetchDvfStats(arrondissement)` pour comparaison
  - Retourner `structuredContent` avec mode "address"

- [x] Format de sortie structuredContent
  ```typescript
  {
    mode: "address",
    address: {
      label: "45 Avenue de la Motte-Picquet 75007 Paris",
      lat: 48.8503,
      lon: 2.3065,
      arrondissement: 7,
      section: "75107000AK"
    },
    section: {
      // DvfStats de la section (peut être null si pas de données)
      nom: "Section AK",
      appartements: { prix_moyen: 19012, prix_median: 18681, nb_ventes: 54 },
      maisons: { ... }
    },
    arrondissement: {
      // DvfStats de l'arrondissement
      nom: "Paris 7e",
      appartements: { prix_moyen: 14902, prix_median: 14400, nb_ventes: 4385 },
      maisons: { ... }
    },
    ecart_pct: 28  // (section.prix_median - arr.prix_median) / arr.prix_median * 100
  }
  ```

- [x] UI mode "address" dans `mcp-app.ts`
  - Nouveau renderer `renderAddress(data)`
  - Carte centrée sur l'adresse avec marker (Leaflet `L.divIcon` CSS, pas d'image externe)
  - Arrondissement en surbrillance
  - Affichage comparatif : 2 colonnes (section vs arrondissement) + écart %
  - Toggle Apparts/Maisons recalcule l'écart côté client

- [x] Gestion des cas limites
  - Adresse hors Paris → erreur "Adresse hors Paris"
  - Section sans données DVF → `section = null`, affiche stats arrondissement uniquement
  - Géocodage échoué → erreur "Adresse non trouvée"
  - Reverse geocoding échoué → `section = null`, dégradation gracieuse

- [x] Widget sizing
  - Mode address : max-width 450px (entre single 380px et compare 520px)
  - Transition CSS smooth

### Test

- [x] Prompt "prix immobilier 45 avenue de la Motte-Picquet Paris 7"
  - Résultat : géocodé dans le 15e (n°45 côté 15e), section DE, +10% vs arr.
- [ ] Prompt "prix rue de la Roquette Paris 11" (sans numéro)
- [ ] Prompt "prix 1 place de la Concorde Paris" (section très chère)
- [ ] Prompt "prix 12 rue de Belleville Paris 20" (section moins chère)
- [x] Vérifier marker sur la carte
- [x] Vérifier calcul écart % correct

---

## v0.6 — Carte interactive avec sections cliquables ✅

**Objectif** : L'utilisateur navigue sur la carte et clique sur les sections pour voir les stats

### UX cible

```
┌──────────────────────────────────────────────────────────────┐
│  📍 Paris 7e                                   [Apparts ▼]   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  │   Sections colorées selon prix médian                │    │
│  │   (vert = moins cher, rouge = plus cher)             │    │
│  │                                                      │    │
│  │   User clique une section → stats en bas             │    │
│  │   User pan/zoom → charge nouvelles sections          │    │
│  │                                                      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  SECTION AK              VS      7E ARRONDISSEMENT   │    │
│  │  18 681 €/m²                     14 400 €/m²         │    │
│  │  54 ventes                       4 385 ventes        │    │
│  │                    (+28% ↑)                          │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### Sources de données

**Géométries des sections cadastrales** :
```
GET https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/75107/geojson/sections
```
→ Retourne le GeoJSON de toutes les sections du 7e arrondissement

**Stats par section** (déjà disponible via v0.4) :
```typescript
// Toutes les sections d'un arrondissement
await mcpDataGouv.queryResourceData({
  resource_id: "851d342f-9c96-41c1-924a-11a7a7aae8a6",
  filter_column: "code_parent",
  filter_value: "75107",  // arrondissement
  filter_operator: "exact",
  page_size: 100  // ~60 sections par arrondissement
});
```

### Tasks

**Serveur MCP** :
- [x] Nouveau helper `fetchSectionsGeoJSON(arrondissement: number)`
  - Appelle cadastre.data.gouv.fr
  - Retourne le GeoJSON des sections

- [x] Nouveau helper `fetchAllSectionStats(arrondissement: number)`
  - Appelle MCP data.gouv avec `filter_column: "code_parent"`
  - Retourne un Record<sectionCode, SectionStatsEntry>

- [x] Enrichir `structuredContent` dans les tools existants
  ```typescript
  structuredContent: {
    ...existingData,
    sections: {
      geojson: sectionsGeoJSON,
      stats: sectionStatsMap  // { "75107000AK": { prix_median: 18681, ... }, ... }
    }
  }
  ```

**UI (mcp-app.ts)** :
- [x] Fonction `renderSectionsLayer(geojson, statsMap)`
  - Créer un `L.geoJSON` layer avec style dynamique
  - `fillColor` selon prix médian (échelle vert → rouge)
  - `fillOpacity: 0.55` pour voir la carte en dessous

- [x] Échelle de couleurs pour le choropleth
  ```typescript
  function getPriceColor(prix: number): string {
    // Paris : 8000 (bas) → 25000 (haut)
    // Interpolation vert → jaune → rouge
  }
  ```

- [x] Event listener clic sur section
  - Clic → `updateSectionInfo()` + re-render highlight
  - Mouseover → highlight border
  - Tooltip avec nom + prix

- [x] Panneau info en bas du widget
  - Affiche les stats de la section cliquée
  - Comparaison avec l'arrondissement
  - Animation slide-up à l'apparition

- [x] Légende de la carte (8K → 25K €/m²)

**Lazy loading (optionnel mais recommandé)** :
- [ ] Écouter `map.on('moveend')` 
- [ ] Détecter si on a changé d'arrondissement visible
- [ ] Charger les sections du nouvel arrondissement
- [ ] Attention : nécessite d'appeler le serveur MCP → peut nécessiter postMessage

### CSP à ajouter

```typescript
// Dans server.ts, resourceDomains
resourceDomains: [
  "tile.openstreetmap.org",
  "cadastre.data.gouv.fr"  // pour les GeoJSON sections
]
```

### Contrainte MCP Apps

L'iframe ne peut pas faire de nouveaux appels au serveur MCP après le render initial. Solutions :

**Option 1 : Précharger toutes les sections de Paris** (~1000 sections)
- Avantage : navigation fluide, pas de loading
- Inconvénient : payload initial plus gros (~500KB GeoJSON + stats)

**Option 2 : Charger uniquement l'arrondissement demandé**
- Avantage : payload léger
- Inconvénient : pas de navigation vers autres arrondissements sans nouveau tool call

**Recommandation** : Option 2 pour le MVP, Option 1 si les perfs le permettent

### Tests

- [x] Build OK, pas d'erreur TypeScript
- [ ] Charger Paris 7e → sections colorées visibles
- [ ] Cliquer section AK → panneau affiche stats + écart %
- [ ] Vérifier échelle de couleurs cohérente (Invalides plus rouge que périphérie)
- [ ] Toggle Apparts/Maisons → couleurs se mettent à jour
- [ ] Légende visible et lisible
- [ ] Dark mode : couleurs toujours visibles
- [ ] Mode address : section de l'adresse avec contour bleu épais
- [ ] Mode compare : pas de sections (inchangé)

---

## v0.7 — Liste des mutations (optionnel) 📋

**Objectif** : Lien vers les mutations récentes

- [ ] Générer deep-link vers explorateur DVF
  ```
  https://explore.data.gouv.fr/immobilier?lat={lat}&lon={lon}&zoom=15
  ```
- [ ] Bouton "Voir les mutations" dans le widget

---

## v0.8 — UI Fullscreen avec navigation interactive ✅

**Objectif** : Mode expanded plein ecran avec layout split, recherche interactive depuis l'UI

- [x] Bouton expand/collapse dans le header (icone SVG)
- [x] Widget passe a 100vh en fullscreen (layout split 60/40)
- [x] Barre de recherche : input adresse + dropdown arrondissement
- [x] `app.callServerTool()` pour rechercher sans passer par Claude
- [x] Loading overlay avec spinner
- [x] Responsive mobile (stack vertical 50/50)
- [x] Zoom molette + controles en fullscreen
- [x] Widget inline elargi a 760px
- [x] Detection capabilities host (fullscreen, serverTools)

---

## Hors scope v1.0

- 🔴 Évolution des prix dans le temps (nécessite historique indexé)
- 🔴 Mutations temps réel dans le widget (données brutes non requêtables)
- 🔴 Notifications prix (nécessite backend avec jobs)
- 🟡 Comparaison France entière (possible mais volumineux)
- 🟡 Export PDF/Excel

---

## Priorisation

```
v0.4 ✅ (données temps réel) ──┐
                              ├──▶ v0.5 ✅ (recherche adresse)
v0.3 ✅ ──────────────────────┘              │
                                             ▼
                                v0.6 ✅ (sections cliquables)
                                             │
                                             ▼
                                v0.8 ✅ (fullscreen + recherche UI) ──▶ v1.0
```

**MVP v1.0** = v0.4 + v0.5 + v0.6 + v0.8

| Version | Impact UX | Effort | Status |
|---------|-----------|--------|--------|
| v0.4 | ⭐⭐⭐ | Moyen | ✅ Done |
| v0.5 | ⭐⭐⭐⭐⭐ | Moyen | ✅ Done |
| v0.6 | ⭐⭐⭐⭐ | Moyen-Élevé | ✅ Done |
| v0.7 | ⭐⭐ | Faible | Optionnel |
| v0.8 | ⭐⭐⭐⭐ | Élevé | ✅ Done |

# DVF Paris - Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

---

## [0.8.0] - 2026-01-30

### Added
- Mode fullscreen avec layout split horizontal (carte 60% + panneau info 40%)
- Bouton expand/collapse dans le header (icone SVG)
- Barre de recherche interactive en fullscreen : input adresse + dropdown arrondissement (1-20)
- Appels `app.callServerTool()` depuis l'UI (recherche sans passer par Claude)
- Loading overlay avec spinner sur la carte pendant les requetes
- Zoom molette + controles zoom en fullscreen
- Responsive mobile : `@media (max-width: 768px)` stack vertical 50/50

### Changed
- Widget inline elargi a `max-width: 760px` (au lieu de 380/450/520px selon le mode)
- `App` constructor declare `availableDisplayModes: ["inline", "fullscreen"]`
- `processToolResult()` extrait de `ontoolresult` pour reutilisation avec `callServerTool`
- `handleHostContext()` reagit aux changements de `displayMode` du host
- DOM restructure : `.header-actions`, `.search-bar`, `.content-layout` (grid container), `.content-map`, `.content-info`
- Version bumped `0.6.0` -> `0.8.0`

### Technical
- Detection `getHostCapabilities().serverTools` avant d'activer la recherche UI
- Detection `getHostContext().availableDisplayModes` avant d'afficher le bouton fullscreen
- `map.invalidateSize()` apres transition CSS (350ms)
- Search bar desactivee si host ne supporte pas `callServerTool`
- Bouton fullscreen cache si host ne supporte pas le mode fullscreen

---

## [0.6.0] - 2026-01-30

### Added
- Carte choropleth des sections cadastrales colorées selon le prix médian (vert → jaune → rouge)
- Module `src/api/cadastre.ts` : client API cadastre.data.gouv.fr pour les géométries de sections
- Fonction `fetchAllSectionStats()` dans `src/api/data-gouv.ts` : récupère les stats DVF de toutes les sections d'un arrondissement
- Helper `fetchSectionsDataForArr()` dans `server.ts` : charge GeoJSON + stats en parallèle
- Layer Leaflet `L.geoJSON` interactif : hover highlight, clic → panneau info, tooltip avec prix
- Panneau info section cliquée : stats section vs arrondissement + écart %
- Légende de la carte (8K → 25K €/m²) en overlay bas-droite
- Animation slide-up à l'ouverture du panneau info section
- Cache mémoire 30min pour les géométries cadastrales (stables dans le temps)
- Cache mémoire 5min pour les stats de toutes les sections d'un arrondissement

### Fixed
- Zoom carte adapté : `fitBounds` sur le layer sections au lieu du zoom global Paris

### Changed
- `get-dvf-stats` enrichi avec `sections` (GeoJSON + stats) dans `structuredContent`
- `search-dvf-address` enrichi avec `sections` dans `structuredContent`
- `compare-dvf-stats` inchangé (pas de sections en mode comparaison)
- `ontoolresult` détecte et charge les sections data, appelle `renderSectionsLayer()`
- `setType()` (toggle Apparts/Maisons) re-render les couleurs du choropleth et le panneau info
- `renderSingle()` et `renderAddress()` gèrent le re-render sections au toggle
- `renderCompare()` nettoie les sections (pas de choropleth en mode compare)
- Div `.map-container` wrappée dans `.map-wrapper` (position relative pour la légende)
- Version serveur et app bumped `0.5.0` → `0.6.0`

### Technical
- Sections GeoJSON fetchées côté serveur (pas de CSP nécessaire côté UI)
- Approche Option 2 du backlog : chargement par arrondissement (pas tout Paris)
- Dégradation gracieuse si cadastre API ou stats sections échouent → widget sans sections
- `SectionStatsEntry` interface légère (sans coords) pour le payload sections

---

## [0.5.0] - 2026-01-30

### Added
- Tool `search-dvf-address` : recherche par adresse parisienne
- Module `src/api/geoplateforme.ts` : client géocodage API Géoplateforme (forward + reverse)
- Géocodage en 2 étapes : adresse → coordonnées → section cadastrale
- Stats par section cadastrale comparées à l'arrondissement
- Calcul écart % (section vs arrondissement) sur prix médian
- UI mode "address" : 2 colonnes comparatives (section vs arrondissement)
- Marker CSS (`L.divIcon`) sur la carte — pas d'image externe, pas de CSP
- Carte zoomée niveau rue (zoom 15) centrée sur l'adresse
- Widget 450px en mode address (entre single 380px et compare 520px)
- Recalcul écart % côté client au toggle Apparts/Maisons
- Dégradation gracieuse : reverse geocoding ou section DVF manquants → stats arrondissement uniquement
- Validation Paris uniquement (`citycode.startsWith("751")`)

### Changed
- `render()` dispatch vers `renderSingle()` / `renderCompare()` / `renderAddress()` selon le mode
- `ontoolresult` détecte le mode address via `isAddressData()` type guard
- `ontoolinput` affiche "Recherche : {adresse}..." pendant le chargement
- `renderSingle()` et `renderCompare()` nettoient le marker et la classe `.address-mode`
- Version serveur et app bumped `0.4.0` → `0.5.0`

### Tested
- Build OK, pas d'erreur TypeScript
- Validé sur Claude Desktop : "prix 45 avenue de la Motte-Picquet Paris 7"
  - Géocodé dans le 15e (n°45 côté 15e, l'avenue traverse 7e/15e)
  - Section DE : 11 295 €/m², +10% vs Paris 15e (10 222 €/m²)
  - Marker positionné, carte zoomée, dark mode OK

---

## [0.4.0] - 2026-01-30

### Added
- Données DVF temps réel via API tabulaire data.gouv.fr
- Module `src/api/data-gouv.ts` : client API avec cache 5min et timeout 5s
- Fallback automatique vers JSON statique si API indisponible
- `fetchDvfStatsBySection()` prêt pour v0.5

### Changed
- `get-dvf-stats` et `compare-dvf-stats` appellent l'API au lieu du JSON
- `compare-dvf-stats` utilise `Promise.all` (appels parallèles)
- Type `DvfEntry` déplacé dans `src/api/data-gouv.ts`

### Tested
- Build OK, pas d'erreur TypeScript
- Validé sur claude.ai : `get-dvf-stats` Paris 11e → données API (prix médian maisons 11 600 vs 11 300 dans le JSON statique)
- Validé sur claude.ai : `compare-dvf-stats` Paris 6e vs 20e → bar chart avec données API
- Carte, toggle Apparts/Maisons, bar chart fonctionnels

---

## [0.3.0] - 2026-01-29

### Added
- Tool `compare-dvf-stats` : compare les stats DVF entre 2 arrondissements
- Bar chart SVG pur (3 métriques groupées : prix moyen, médian, nb ventes)
- Mode comparaison dans l'UI : détection via `structuredContent.mode === "compare"`
- Carte : 2 arrondissements en surbrillance (bleu + orange) avec fitBounds combiné
- Widget passe de 380px → 520px en mode comparaison (transition CSS)
- Légende colorée dans le chart SVG
- Protection XSS dans le SVG via `escapeXml()`

### Changed
- `highlightArrondissement()` → `highlightArrondissements(num1, num2?)` (rétrocompatible)
- `render()` dispatch vers `renderSingle()` / `renderCompare()` selon le mode
- `ontoolresult` détecte automatiquement le mode (single vs compare)
- `ontoolinput` gère les args `arrondissement_1/2` pour le loading state

### Fixed
- Labels tronqués dans le bar chart SVG quand la barre est proche du max (réserve 110px pour les valeurs)

### Tested
- Build OK, pas d'erreur TypeScript
- Validé sur claude.ai (Claude Desktop) : compare-dvf-stats appelle le bon tool
- Carte 2 couleurs (bleu 1er, orange 20e) OK
- Bar chart lisible avec les 3 métriques complètes
- Toggle Apparts/Maisons met à jour le bar chart en mode comparaison
- Retour en mode single après compare : widget revient à 380px

---

## [0.2.0] - 2026-01-29

### Added
- Carte interactive Leaflet + OpenStreetMap dans le widget
- Contours GeoJSON des 20 arrondissements (source opendata.paris.fr)
- Mise en surbrillance de l'arrondissement demandé (polygone bleu)
- CSP `resourceDomains` pour les tuiles OSM
- Dark mode : filtre CSS invert/hue-rotate sur les tuiles
- ResizeObserver pour maintenir la carte à jour

### Tested
- Validé sur claude.ai via Streamable HTTP + tunnel ngrok
- Carte affichée, arrondissement en surbrillance, dark mode OK
- Toggle Appartements/Maisons stable avec la carte

---

## [0.1.0] - 2025-01-29

### Added
- Setup projet MCP Apps SDK (`@modelcontextprotocol/ext-apps`)
- Tool `get-dvf-stats` : stats DVF par arrondissement (1-20)
- Widget UI vanilla JS : prix moyen, prix médian, nb ventes en €/m²
- Toggle Appartements / Maisons
- Style sobre avec CSS variables du host (dark mode automatique)
- Données DVF Paris pré-calculées pour les 20 arrondissements (source data.gouv.fr)
- Transport stdio + Streamable HTTP
- Config Claude Desktop

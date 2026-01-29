# DVF Paris - Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

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

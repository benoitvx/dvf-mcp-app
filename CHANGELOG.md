# DVF Paris - Changelog

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased]

---

## [0.2.0] - 2026-01-29

### Added
- Carte interactive Leaflet + OpenStreetMap dans le widget
- Contours GeoJSON des 20 arrondissements (source opendata.paris.fr)
- Mise en surbrillance de l'arrondissement demandé (polygone bleu)
- CSP `resourceDomains` pour les tuiles OSM
- Dark mode : filtre CSS invert/hue-rotate sur les tuiles
- ResizeObserver pour maintenir la carte à jour

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

# DVF Paris - Backlog

> POC MCP App pour Claude — Scope minimal pour démo

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

## Hors scope POC

- Recherche par adresse/rue
- Évolution des prix dans le temps
- Filtres type de bien / surface
- Fetch temps réel des données (on utilise JSON statique généré par Claude Code)

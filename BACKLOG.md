# DVF Paris - Backlog

> POC MCP App pour Claude — Scope minimal pour démo

## MVP (v0.1) — Widget stats DVF

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

## v0.2 — Carte interactive (post-POC)

- [x] Intégrer Leaflet + OpenStreetMap
- [x] Centrer sur l'arrondissement demandé
- [x] Afficher les limites de l'arrondissement

## v0.3 — Comparaison (post-POC)

- [ ] Comparer 2 arrondissements
- [ ] Graphique bar chart des prix

---

## Hors scope POC

- Recherche par adresse/rue
- Évolution des prix dans le temps
- Filtres type de bien / surface
- Fetch temps réel des données (on utilise JSON statique généré par Claude Code)

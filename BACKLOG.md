# DVF Paris - Backlog

> POC MCP App pour Claude — Scope minimal pour démo

## MVP (v0.1) — Widget stats DVF

**Objectif** : Prompt "prix immobilier Paris 11" → widget avec stats

### Setup (via skill `create-mcp-app`)
- [ ] Demander à Claude Code de scaffolder le projet avec le skill
- [ ] Claude Code génère `dvf-paris.json` avec stats des 20 arrondissements (depuis data.gouv.fr)
- [ ] Init Git + premier commit

### MCP Server
- [ ] Tool `get-dvf-stats` avec input `arrondissement` (1-20)
- [ ] Resource `ui://dvf/mcp-app.html`
- [ ] Retourner `structuredContent` avec les stats

### UI Widget
- [ ] Shell HTML + mcp-app.ts
- [ ] Afficher : arrondissement, prix moyen, prix médian, nb ventes
- [ ] Style minimal (Tailwind ou CSS inline)

### Test
- [ ] Config Claude Desktop (stdio)
- [ ] Test prompt "prix Paris 11"
- [ ] Vérifier que le widget s'affiche

---

## v0.2 — Carte interactive (post-POC)

- [ ] Intégrer Leaflet + OpenStreetMap
- [ ] Centrer sur l'arrondissement demandé
- [ ] Afficher les limites de l'arrondissement

## v0.3 — Comparaison (post-POC)

- [ ] Comparer 2 arrondissements
- [ ] Graphique bar chart des prix

---

## Hors scope POC

- Recherche par adresse/rue
- Évolution des prix dans le temps
- Filtres type de bien / surface
- Fetch temps réel des données (on utilise JSON statique généré par Claude Code)

/**
 * Client API tabulaire data.gouv.fr — Statistiques DVF
 *
 * Dataset : Statistiques DVF (64998de5926530ebcecc7b15)
 * Resource : 851d342f-9c96-41c1-924a-11a7a7aae8a6
 */

const BASE_URL =
  "https://tabular-api.data.gouv.fr/api/resources/851d342f-9c96-41c1-924a-11a7a7aae8a6/data/";

const FETCH_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DvfApiRow {
  code_geo: string;
  libelle_geo: string;
  echelle_geo: string;
  code_parent: string | null;
  nb_ventes_whole_appartement: number | null;
  moy_prix_m2_whole_appartement: number | null;
  med_prix_m2_whole_appartement: number | null;
  nb_ventes_whole_maison: number | null;
  moy_prix_m2_whole_maison: number | null;
  med_prix_m2_whole_maison: number | null;
}

interface DvfApiResponse {
  data: DvfApiRow[];
  meta: { total: number; page: number; page_size: number };
}

export type DvfEntry = {
  arrondissement: number;
  nom: string;
  appartements: { prix_moyen: number; prix_median: number; nb_ventes: number };
  maisons: { prix_moyen: number; prix_median: number; nb_ventes: number };
  coords: { lat: number; lon: number };
};

// ---------------------------------------------------------------------------
// Coords statiques des 20 arrondissements (centres approximatifs)
// ---------------------------------------------------------------------------

const ARRONDISSEMENT_COORDS: Record<number, { lat: number; lon: number }> = {
  1: { lat: 48.8602, lon: 2.3477 },
  2: { lat: 48.8687, lon: 2.3441 },
  3: { lat: 48.8637, lon: 2.3615 },
  4: { lat: 48.8543, lon: 2.3572 },
  5: { lat: 48.8449, lon: 2.3497 },
  6: { lat: 48.8499, lon: 2.3331 },
  7: { lat: 48.8566, lon: 2.3126 },
  8: { lat: 48.8763, lon: 2.3106 },
  9: { lat: 48.8772, lon: 2.3378 },
  10: { lat: 48.8762, lon: 2.3598 },
  11: { lat: 48.8592, lon: 2.3806 },
  12: { lat: 48.8399, lon: 2.3876 },
  13: { lat: 48.8322, lon: 2.3561 },
  14: { lat: 48.8286, lon: 2.3269 },
  15: { lat: 48.8421, lon: 2.2988 },
  16: { lat: 48.8637, lon: 2.2769 },
  17: { lat: 48.8875, lon: 2.3133 },
  18: { lat: 48.8925, lon: 2.3444 },
  19: { lat: 48.8867, lon: 2.3802 },
  20: { lat: 48.8638, lon: 2.3985 },
};

// ---------------------------------------------------------------------------
// Cache mémoire
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: DvfEntry;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): DvfEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function cacheSet(key: string, data: DvfEntry): void {
  cache.set(key, { data, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapRowToDvfEntry(row: DvfApiRow, arrNum: number): DvfEntry {
  return {
    arrondissement: arrNum,
    nom: row.libelle_geo.replace(" Arrondissement", ""),
    appartements: {
      prix_moyen: Math.round(row.moy_prix_m2_whole_appartement ?? 0),
      prix_median: Math.round(row.med_prix_m2_whole_appartement ?? 0),
      nb_ventes: row.nb_ventes_whole_appartement ?? 0,
    },
    maisons: {
      prix_moyen: Math.round(row.moy_prix_m2_whole_maison ?? 0),
      prix_median: Math.round(row.med_prix_m2_whole_maison ?? 0),
      nb_ventes: row.nb_ventes_whole_maison ?? 0,
    },
    coords: ARRONDISSEMENT_COORDS[arrNum] ?? { lat: 48.8566, lon: 2.3522 },
  };
}

// ---------------------------------------------------------------------------
// Fetch helper avec timeout
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Fonctions publiques
// ---------------------------------------------------------------------------

/**
 * Récupère les stats DVF d'un arrondissement parisien (1-20).
 * Code INSEE : 75101 … 75120.
 */
export async function fetchDvfStats(arrondissement: number): Promise<DvfEntry> {
  const cacheKey = `arr-${arrondissement}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const codeInsee = `751${String(arrondissement).padStart(2, "0")}`;
  const url = `${BASE_URL}?code_geo__exact=${codeInsee}&page_size=1`;

  const res = await fetchWithTimeout(url);
  const json = (await res.json()) as DvfApiResponse;

  if (!json.data || json.data.length === 0) {
    throw new Error(`Aucune donnée DVF pour l'arrondissement ${arrondissement} (code ${codeInsee})`);
  }

  const entry = mapRowToDvfEntry(json.data[0], arrondissement);
  cacheSet(cacheKey, entry);
  return entry;
}

/**
 * Récupère les stats DVF d'une section cadastrale (ex: "75107000AK").
 * Prêt pour v0.5 (recherche par adresse).
 */
export async function fetchDvfStatsBySection(sectionCode: string): Promise<DvfEntry> {
  const cacheKey = `section-${sectionCode}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}?code_geo__exact=${sectionCode}&page_size=1`;

  const res = await fetchWithTimeout(url);
  const json = (await res.json()) as DvfApiResponse;

  if (!json.data || json.data.length === 0) {
    throw new Error(`Aucune donnée DVF pour la section ${sectionCode}`);
  }

  // Extraire le numéro d'arrondissement du code section (75107000AK → 7)
  const arrNum = parseInt(sectionCode.substring(3, 5), 10);

  const entry = mapRowToDvfEntry(json.data[0], arrNum);
  cacheSet(cacheKey, entry);
  return entry;
}

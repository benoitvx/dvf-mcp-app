/**
 * Client API cadastre.data.gouv.fr — Sections cadastrales GeoJSON
 *
 * Endpoint : https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/{code}/geojson/sections
 */

const CADASTRE_BASE =
  "https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes";

const FETCH_TIMEOUT_MS = 10_000; // 10s — fichier plus gros que les stats
const CACHE_TTL_MS = 30 * 60 * 1_000; // 30 minutes — géométries stables

// ---------------------------------------------------------------------------
// Cache mémoire
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: GeoJSON.FeatureCollection;
  ts: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): GeoJSON.FeatureCollection | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.data;
}

function cacheSet(key: string, data: GeoJSON.FeatureCollection): void {
  cache.set(key, { data, ts: Date.now() });
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
// Fonction publique
// ---------------------------------------------------------------------------

/**
 * Récupère le GeoJSON des sections cadastrales d'un arrondissement parisien.
 * Code INSEE : 75101 … 75120.
 */
export async function fetchSectionsGeoJSON(
  arrondissement: number,
): Promise<GeoJSON.FeatureCollection> {
  const codeInsee = `751${String(arrondissement).padStart(2, "0")}`;
  const cacheKey = `sections-${codeInsee}`;

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `${CADASTRE_BASE}/${codeInsee}/geojson/sections`;
  const res = await fetchWithTimeout(url);
  const geojson = (await res.json()) as GeoJSON.FeatureCollection;

  cacheSet(cacheKey, geojson);
  return geojson;
}

/**
 * Client API Géoplateforme — Géocodage
 *
 * Forward geocoding + reverse geocoding parcelle pour obtenir
 * la section cadastrale d'une adresse parisienne.
 *
 * @see https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage
 */

const GEOCODE_BASE = "https://data.geopf.fr/geocodage";
const FETCH_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoResult {
  label: string; // "45 Avenue de la Motte-Picquet 75007 Paris"
  lat: number;
  lon: number;
  citycode: string; // "75107"
  arrondissement: number; // 7
  section: string | null; // "75107000AK" (null si reverse geocoding échoue)
}

interface GeocodeFeature {
  properties: {
    label: string;
    citycode: string;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: [number, number]; // [lon, lat]
  };
}

interface GeocodeResponse {
  features: GeocodeFeature[];
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
 * Géocode une adresse parisienne et retourne les coordonnées + section cadastrale.
 *
 * 1. Forward geocoding → coordonnées + citycode
 * 2. Reverse geocoding parcelle → section cadastrale
 */
export async function geocodeAddress(adresse: string): Promise<GeoResult> {
  // 1. Forward geocoding
  const searchUrl = `${GEOCODE_BASE}/search?q=${encodeURIComponent(adresse)}&limit=1`;
  const searchRes = await fetchWithTimeout(searchUrl);
  const searchData = (await searchRes.json()) as GeocodeResponse;

  if (!searchData.features || searchData.features.length === 0) {
    throw new Error("Adresse non trouvée");
  }

  const feature = searchData.features[0];
  const { citycode, label } = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;

  // Valider que l'adresse est bien à Paris (code INSEE 751xx)
  if (!citycode.startsWith("751")) {
    throw new Error("Adresse hors Paris");
  }

  const arrondissement = parseInt(citycode.substring(3), 10);

  // 2. Reverse geocoding pour obtenir la parcelle → section
  let section: string | null = null;
  try {
    const reverseUrl = `${GEOCODE_BASE}/reverse?lon=${lon}&lat=${lat}&index=parcel`;
    const reverseRes = await fetchWithTimeout(reverseUrl);
    const reverseData = (await reverseRes.json()) as GeocodeResponse;

    if (reverseData.features && reverseData.features.length > 0) {
      const parcelId = reverseData.features[0].properties.id as
        | string
        | undefined;
      if (parcelId && parcelId.length >= 10) {
        section = parcelId.substring(0, 10);
      }
    }
  } catch {
    // Dégradation gracieuse : pas de section, on continue avec l'arrondissement
    console.warn("[Géoplateforme] Reverse geocoding échoué, section = null");
  }

  return { label, lat, lon, citycode, arrondissement, section };
}

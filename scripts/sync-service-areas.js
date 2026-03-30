#!/usr/bin/env node
/**
 * sync-service-areas.js
 * Fetches the service area from Google Business Profile API,
 * geocodes each town, computes a boundary polygon, and writes
 * /js/service-areas.js so all map pages stay in sync automatically.
 *
 * Required environment variables (set as GitHub Secrets):
 *   GBP_CLIENT_ID       — OAuth 2.0 client ID
 *   GBP_CLIENT_SECRET   — OAuth 2.0 client secret
 *   GBP_REFRESH_TOKEN   — offline refresh token
 *   GBP_LOCATION_NAME   — e.g. "accounts/123456789/locations/987654321"
 *   MAPS_API_KEY        — existing Google Maps/Places API key
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const {
  GBP_CLIENT_ID,
  GBP_CLIENT_SECRET,
  GBP_REFRESH_TOKEN,
  GBP_LOCATION_NAME,
  MAPS_API_KEY,
} = process.env;

// Home base always stays as the first pin
const HOME_BASE = {name: 'Plainville', lat: 42.0034, lng: -71.3306, home: true};

// ── helpers ──────────────────────────────────────────────────────────────────

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers,
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── OAuth: exchange refresh token for access token ───────────────────────────

async function getAccessToken() {
  const params = new URLSearchParams({
    client_id: GBP_CLIENT_ID,
    client_secret: GBP_CLIENT_SECRET,
    refresh_token: GBP_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const res = await httpsPost('https://oauth2.googleapis.com/token', params.toString());
  if (!res.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(res));
  return res.access_token;
}

// ── GBP API: fetch service area place IDs ────────────────────────────────────

async function fetchServiceAreaPlaceIds(accessToken) {
  const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${GBP_LOCATION_NAME}?readMask=serviceArea`;
  const res = await httpsGet(url, {Authorization: `Bearer ${accessToken}`});
  const placeInfos = res?.serviceArea?.places?.placeInfos || [];
  // Return just the place names (GBP returns names like "places/ChIJ...")
  return placeInfos.map(p => ({
    name: p.displayName || p.name,
    placeId: p.placeId || (p.name && p.name.replace('places/', '')),
  }));
}

// ── Places API: geocode a place ID to lat/lng ────────────────────────────────

async function geocodePlaceId(placeId, displayName) {
  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=displayName,location&key=${MAPS_API_KEY}`;
  const res = await httpsGet(url, {'X-Goog-FieldMask': 'displayName,location'});
  if (res?.location?.latitude) {
    return {
      name: displayName || res.displayName?.text || placeId,
      lat: res.location.latitude,
      lng: res.location.longitude,
    };
  }
  return null;
}

// ── Convex hull (Graham scan) + buffer ───────────────────────────────────────

function crossProduct(O, A, B) {
  return (A.lat - O.lat) * (B.lng - O.lng) - (A.lng - O.lng) * (B.lat - O.lat);
}

function convexHull(points) {
  const pts = [...points].sort((a, b) => a.lat !== b.lat ? a.lat - b.lat : a.lng - b.lng);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

function bufferHull(hull, bufferDeg = 0.05) {
  // Find centroid
  const cx = hull.reduce((s, p) => s + p.lat, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.lng, 0) / hull.length;
  // Push each point outward from centroid
  return hull.map(p => {
    const dx = p.lat - cx;
    const dy = p.lng - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      lat: Math.round((p.lat + (dx / len) * bufferDeg) * 1e4) / 1e4,
      lng: Math.round((p.lng + (dy / len) * bufferDeg) * 1e4) / 1e4,
    };
  });
}

// ── Write output file ────────────────────────────────────────────────────────

function writeServiceAreasFile(towns, boundary) {
  const today = new Date().toISOString().slice(0, 10);
  const townsJson = towns
    .map(t => {
      const homeFlag = t.home ? ', home:true' : '';
      return `    {name:${JSON.stringify(t.name)}, lat:${t.lat}, lng:${t.lng}${homeFlag}}`;
    })
    .join(',\n');
  const boundaryJson = boundary
    .map(p => `    {lat:${p.lat},lng:${p.lng}}`)
    .join(',\n');

  const content = `// Auto-generated — do not edit by hand.
// Updated daily by GitHub Actions from Google Business Profile.
// Last synced: ${today}
window.JCD_SERVICE_AREAS = {
  towns: [
${townsJson}
  ],
  boundary: [
${boundaryJson}
  ]
};
`;

  const outPath = path.join(__dirname, '..', 'js', 'service-areas.js');
  const existing = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  // Strip the date line for comparison so a date-only diff doesn't cause a commit
  const strip = s => s.replace(/\/\/ Last synced: .+/, '');
  if (strip(existing) === strip(content)) {
    console.log('No changes to service areas.');
    process.exit(0);
  }
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Written ${towns.length} towns + ${boundary.length}-point boundary to js/service-areas.js`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!GBP_CLIENT_ID || !GBP_REFRESH_TOKEN || !GBP_LOCATION_NAME || !MAPS_API_KEY) {
    console.error('Missing required environment variables. See script header for details.');
    process.exit(1);
  }

  console.log('Getting access token...');
  const token = await getAccessToken();

  console.log('Fetching service area from GBP...');
  const placeInfos = await fetchServiceAreaPlaceIds(token);
  console.log(`Found ${placeInfos.length} service area towns.`);

  console.log('Geocoding towns...');
  const geocoded = [];
  for (const info of placeInfos) {
    const result = await geocodePlaceId(info.placeId, info.name);
    if (result) {
      console.log(`  ✓ ${result.name} (${result.lat}, ${result.lng})`);
      geocoded.push(result);
    } else {
      console.warn(`  ✗ Could not geocode: ${info.name}`);
    }
  }

  // Always keep home base first
  const towns = [HOME_BASE, ...geocoded.filter(t => t.name !== 'Plainville')];

  // Compute boundary from all town positions
  const allPoints = towns.map(t => ({lat: t.lat, lng: t.lng}));
  const hull = convexHull(allPoints);
  const boundary = bufferHull(hull, 0.06);

  writeServiceAreasFile(towns, boundary);
}

main().catch(err => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});

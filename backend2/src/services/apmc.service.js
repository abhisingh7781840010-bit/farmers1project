/**
 * APMC / Mandi Data Service -- e-KisanSetu
 * Uses data.gov.in API for live mandi prices and center locations
 * API Key: stored in process.env.DATAGOV_API_KEY
 *
 * Key datasets:
 * - Agmarknet Daily Mandi Prices: resource_id = 9ef84268-d588-465a-a308-a864a43d0070
 * - APMC Centers: resource_id = 35985678-0d79-46b4-9ed6-6f13308a1d24
 */

const DATAGOV_BASE = 'https://api.data.gov.in/resource';
const AGMARKNET_RESOURCE = '9ef84268-d588-465a-a308-a864a43d0070'; // Daily mandi arrivals + prices
const MSP_RESOURCE = '7c6b7d49-0d9a-4cc7-bc7e-eeb0b89bf48c';       // MSP rates dataset

// Simple in-memory cache (TTL: 30 minutes)
const cache = new Map();
function getCached(key) {
  const e = cache.get(key);
  if (e && Date.now() - e.ts < 30 * 60 * 1000) return e.data;
  return null;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

/**
 * Fetch live mandi prices for a commodity from Agmarknet
 * @param {string} commodity - e.g. 'Wheat', 'Rice', 'Maize'
 * @param {string} state - e.g. 'Uttar Pradesh'
 * @param {number} limit
 */
export async function fetchMandiPrices(commodity = 'Wheat', state = '', limit = 20) {
  const apiKey = process.env.DATAGOV_API_KEY;
  if (!apiKey) {
    console.warn('[APMC] No DATAGOV_API_KEY set, returning mock data');
    return getMockMandiPrices(commodity);
  }

  const cacheKey = `mandi:${commodity}:${state}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      'api-key': apiKey,
      format: 'json',
      limit: String(limit),
      'filters[commodity]': commodity
    });
    if (state) params.set('filters[state]', state);

    const url = DATAGOV_BASE + '/' + AGMARKNET_RESOURCE + '?' + params.toString();
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      console.error('[APMC] API error:', res.status, res.statusText);
      return getMockMandiPrices(commodity);
    }

    const json = await res.json();
    const records = (json.records || []).map(r => ({
      market: r.market || r.Market || r.mkt_nm,
      state: r.state || r.State || r.state_name,
      district: r.district || r.District || r.dist_nm,
      commodity: r.commodity || r.Commodity,
      variety: r.variety || r.Variety,
      arrival_date: r.arrival_date || r['arrival date'] || r.date,
      min_price: Number(r.min_price || r['min price'] || 0),
      max_price: Number(r.max_price || r['max price'] || 0),
      modal_price: Number(r.modal_price || r['modal price'] || r.modalprice || 0),
      unit: r.unit || 'Quintal'
    }));

    setCache(cacheKey, records);
    console.log(`[APMC] Fetched ${records.length} price records for ${commodity}`);
    return records;
  } catch (err) {
    console.error('[APMC] Fetch failed:', err.message);
    return getMockMandiPrices(commodity);
  }
}

/**
 * Fetch current MSP rates from data.gov.in
 */
export async function fetchMSPRates() {
  const apiKey = process.env.DATAGOV_API_KEY;
  if (!apiKey) return getMockMSP();

  const cached = getCached('msp');
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      'api-key': apiKey,
      format: 'json',
      limit: '50'
    });
    const url = DATAGOV_BASE + '/' + MSP_RESOURCE + '?' + params.toString();
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });

    if (!res.ok) return getMockMSP();

    const json = await res.json();
    const records = (json.records || []).map(r => ({
      crop: r.crop || r.Crop || r.commodity,
      msp: Number(r.msp || r.MSP || r.msp_rate || 0),
      year: r.year || r.kharif_rabi || r.season_year || '2024-25',
      unit: r.unit || 'Per Quintal'
    }));

    setCache('msp', records);
    return records;
  } catch (err) {
    return getMockMSP();
  }
}

/**
 * Get summarised price data for dashboard (modal price per crop)
 */
export async function getCropPriceSummary(crops = ['Wheat', 'Rice', 'Maize', 'Mustard', 'Cotton']) {
  const results = [];
  for (const crop of crops) {
    const records = await fetchMandiPrices(crop, '', 5);
    if (records.length > 0) {
      const avgModal = Math.round(records.reduce((s, r) => s + r.modal_price, 0) / records.length);
      results.push({ crop, modal_price: avgModal, unit: 'Per Quintal', records_count: records.length, sample: records[0] });
    }
  }
  return results;
}

// ── Fallback mock data ─────────────────────────────────────────────
function getMockMandiPrices(commodity) {
  const base = { Wheat: 2275, Rice: 2183, Maize: 2090, Mustard: 5650, Cotton: 6620, Soybean: 4600 };
  const price = base[commodity] || 2000;
  return [
    { market: 'Ghaziabad APMC', state: 'Uttar Pradesh', district: 'Ghaziabad', commodity, min_price: price - 150, max_price: price + 200, modal_price: price, unit: 'Quintal', arrival_date: new Date().toLocaleDateString('en-IN') },
    { market: 'Lucknow Mandi', state: 'Uttar Pradesh', district: 'Lucknow', commodity, min_price: price - 100, max_price: price + 180, modal_price: price + 25, unit: 'Quintal', arrival_date: new Date().toLocaleDateString('en-IN') }
  ];
}

function getMockMSP() {
  return [
    { crop: 'Wheat', msp: 2275, year: '2024-25', unit: 'Per Quintal' },
    { crop: 'Rice (Common)', msp: 2183, year: '2024-25', unit: 'Per Quintal' },
    { crop: 'Maize', msp: 2090, year: '2024-25', unit: 'Per Quintal' },
    { crop: 'Mustard', msp: 5650, year: '2024-25', unit: 'Per Quintal' },
    { crop: 'Cotton (Long Staple)', msp: 7121, year: '2024-25', unit: 'Per Quintal' },
    { crop: 'Groundnut', msp: 6783, year: '2024-25', unit: 'Per Quintal' },
    { crop: 'Soybean', msp: 4600, year: '2024-25', unit: 'Per Quintal' },
    { crop: 'Jowar', msp: 3371, year: '2024-25', unit: 'Per Quintal' }
  ];
}

export default { fetchMandiPrices, fetchMSPRates, getCropPriceSummary };

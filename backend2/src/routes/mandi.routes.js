import { Router } from 'express';
import { fetchMandiPrices, fetchMSPRates, getCropPriceSummary } from '../services/apmc.service.js';

const router = Router();

/**
 * GET /api/v1/mandi/prices?commodity=Wheat&state=Uttar+Pradesh
 * Returns live mandi prices from Agmarknet (data.gov.in)
 */
router.get('/prices', async (req, res, next) => {
  try {
    const { commodity = 'Wheat', state = '', limit = 20 } = req.query;
    const prices = await fetchMandiPrices(commodity, state, parseInt(limit));
    res.json({
      success: true,
      source: process.env.DATAGOV_API_KEY ? 'data.gov.in Agmarknet Live API' : 'Mock data (set DATAGOV_API_KEY for live)',
      commodity,
      count: prices.length,
      data: prices
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/mandi/msp
 * Returns current Minimum Support Prices for all crops
 */
router.get('/msp', async (req, res, next) => {
  try {
    const msp = await fetchMSPRates();
    res.json({
      success: true,
      source: process.env.DATAGOV_API_KEY ? 'data.gov.in Ministry of Agriculture' : 'Mock MSP data',
      season: '2024-25',
      count: msp.length,
      data: msp
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/mandi/summary
 * Returns modal price summary for top crops (dashboard widget)
 */
router.get('/summary', async (req, res, next) => {
  try {
    const crops = (req.query.crops || 'Wheat,Rice,Maize,Mustard,Cotton,Soybean').split(',');
    const summary = await getCropPriceSummary(crops);
    res.json({
      success: true,
      source: process.env.DATAGOV_API_KEY ? 'Live Agmarknet data.gov.in' : 'Mock prices',
      data: summary
    });
  } catch (err) { next(err); }
});

export default router;

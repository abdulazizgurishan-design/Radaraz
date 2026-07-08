// lib/sources/index.js
// تجميع جميع مصادر البيانات (بدون Reddit)

import { fetchFinvizData } from './finviz';
import { fetchStockAnalysis } from './stockAnalysis';
import { fetchSeekingAlpha } from './seekingAlpha';
import { fetchETFDatabase } from './etfDatabase';
import { fetchCompaniesMarketCap } from './companiesMarketCap';
import { fetchKoyfin } from './koyfin';
import { fetchMacroMicro } from './macroMicro';
import { fetchFREDData } from './fred';
import { fetchAnalysisSite } from './analysisSite';

export async function fetchAllSources(symbols = []) {
  const results = {
    finviz: null,
    fundamentals: null,
    seekingAlpha: null,
    etf: null,
    marketCap: null,
    koyfin: null,
    macro: null,
    fred: null,
    analysis: null,
    timestamp: new Date().toISOString(),
  };
  
  // ✅ جلب البيانات بالتوازي (بدون Reddit)
  await Promise.allSettled([
    fetchFinvizData().then(data => results.finviz = data),
    fetchStockAnalysis(symbols).then(data => results.fundamentals = data),
    fetchSeekingAlpha(symbols).then(data => results.seekingAlpha = data),
    fetchETFDatabase().then(data => results.etf = data),
    fetchCompaniesMarketCap(symbols).then(data => results.marketCap = data),
    fetchKoyfin().then(data => results.koyfin = data),
    fetchMacroMicro().then(data => results.macro = data),
    fetchFREDData().then(data => results.fred = data),
    fetchAnalysisSite(symbols).then(data => results.analysis = data),
  ]);
  
  return results;
}

// تصدير كل مصدر على حدة
export {
  fetchFinvizData,
  fetchStockAnalysis,
  fetchSeekingAlpha,
  fetchETFDatabase,
  fetchCompaniesMarketCap,
  fetchKoyfin,
  fetchMacroMicro,
  fetchFREDData,
  fetchAnalysisSite,
};

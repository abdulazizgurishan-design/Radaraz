// lib/radar/core/FilterEngine.js
// ============================================================
// RadarAZ v20.1 - Filter Engine (مع سجلات تشخيصية وتأكيد التحميل)
// ============================================================

console.log("🔥 FILTER ENGINE v20.1 LOADED");

import { SCAN_CONFIG } from './config.js';

const DEFAULT_CONFIG = {
  MIN_PRICE: 2,
  MIN_VOLUME: 200000,
  MIN_DOLLAR_VOL: 1000000,
  MAX_ANALYSIS_STOCKS: 300,
};

const config = {
  ...DEFAULT_CONFIG,
  ...(SCAN_CONFIG || {}),
};

export class FilterEngine {
  static applyBasicFilters(universe, options = {}) {
    const {
      minPrice = config.MIN_PRICE,
      minVolume = config.MIN_VOLUME,
      minDollarVol = config.MIN_DOLLAR_VOL,
      maxChangePct = 15,
    } = options;

    console.log(`🔍 [FILTER] START: ${universe?.length || 0}`);

    const priceFiltered = universe.filter(s => {
      const price = Number(s.price ?? 0);
      return Number.isFinite(price) && price >= minPrice;
    });
    console.log(`🔍 [FILTER] PRICE: ${priceFiltered.length}`);

    const volumeFiltered = priceFiltered.filter(s => {
      const volume = Number(s.volume ?? 0);
      return Number.isFinite(volume) && volume >= minVolume;
    });
    console.log(`🔍 [FILTER] VOLUME: ${volumeFiltered.length}`);

    const dollarFiltered = volumeFiltered.filter(s => {
      const dollarVol = Number(s.dollar_vol ?? (s.price ?? 0) * (s.volume ?? 0));
      if (!Number.isFinite(dollarVol)) {
        console.log(`🔍 [BAD DOLLAR] ${s.symbol} price=${s.price} volume=${s.volume} dollar=${s.dollar_vol}`);
      }
      return Number.isFinite(dollarVol) && dollarVol >= minDollarVol;
    });
    console.log(`🔍 [FILTER] DOLLAR: ${dollarFiltered.length}`);

    const changeFiltered = dollarFiltered.filter(s => {
      const change = Math.abs(Number(s.change_pct ?? 0));
      return Number.isFinite(change) && change <= maxChangePct;
    });
    console.log(`🔍 [FILTER] CHANGE: ${changeFiltered.length}`);

    const sorted = changeFiltered.sort((a, b) => {
      const aDollarVol = Number(a.dollar_vol ?? (a.price ?? 0) * (a.volume ?? 0));
      const bDollarVol = Number(b.dollar_vol ?? (b.price ?? 0) * (b.volume ?? 0));
      return (bDollarVol || 0) - (aDollarVol || 0);
    });

    return sorted;
  }

  static applyRadarFilters(universe, options = {}) {
    const { minRvol = 1.5, maxGapPct = 5 } = options;

    console.log(`🔍 [RADAR] START: ${universe?.length || 0}`);

    const rvolFiltered = universe.filter(s => {
      const price = Number(s.price ?? 0);
      const volume = Number(s.volume ?? 0);
      const dollarVol = Number(s.dollar_vol ?? price * volume);

      let avgVolume = Number(s.avgVolume ?? s.avg_volume ?? 0);
      if (avgVolume <= 0) {
        return true;
      }

      const rvol = volume / avgVolume;
      return Number.isFinite(rvol) && rvol >= minRvol;
    });
    console.log(`🔍 [RADAR] RVOL: ${rvolFiltered.length}`);

    const gapFiltered = rvolFiltered.filter(s => {
      const open = Number(s.open ?? 0);
      const prevClose = Number(s.prevClose ?? 0);
      if (prevClose <= 0) return true;
      const gap = ((open - prevClose) / prevClose) * 100;
      return Number.isFinite(gap) && Math.abs(gap) <= maxGapPct;
    });
    console.log(`🔍 [RADAR] GAP: ${gapFiltered.length}`);

    return gapFiltered;
  }

  static selectTopCandidates(universe, limit = 100) {
    if (!universe || universe.length === 0) return [];
    const sorted = [...universe].sort((a, b) => {
      const aDollarVol = Number(a.dollar_vol ?? (a.price ?? 0) * (a.volume ?? 0));
      const bDollarVol = Number(b.dollar_vol ?? (b.price ?? 0) * (b.volume ?? 0));
      return (bDollarVol || 0) - (aDollarVol || 0);
    });
    const result = sorted.slice(0, Math.max(1, limit));
    console.log(`🔍 [FILTER] TOP: ${result.length}`);
    return result;
  }

  static filter(universe, options = {}) {
    const { limit = config.MAX_ANALYSIS_STOCKS || 300 } = options;
    if (!universe || universe.length === 0) {
      console.log('🔍 [FILTER] Universe is empty, returning []');
      return [];
    }

    console.log(`🔍 [FILTER] TOTAL INPUT: ${universe.length}`);

    const basicFiltered = this.applyBasicFilters(universe, options);
    console.log(`🔍 [FILTER] AFTER BASIC: ${basicFiltered.length}`);

    const radarFiltered = this.applyRadarFilters(basicFiltered, options);
    console.log(`🔍 [FILTER] AFTER RADAR: ${radarFiltered.length}`);

    const topCandidates = this.selectTopCandidates(radarFiltered, limit);
    console.log(`🔍 [FILTER] FINAL: ${topCandidates.length}`);

    return topCandidates;
  }

  static getFilterStats(universe, filtered) {
    return {
      totalBefore: universe?.length || 0,
      totalAfter: filtered?.length || 0,
      reductionRate: universe?.length > 0 ? ((universe.length - filtered.length) / universe.length) * 100 : 0,
      topSymbols: filtered?.slice(0, 5).map(s => s.symbol) || [],
    };
  }
}

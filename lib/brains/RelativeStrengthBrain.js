// lib/radar/brains/RelativeStrengthBrain.js
import { Brain } from '../core/Brain.js';

export class RelativeStrengthBrain extends Brain {
  static dependencies = ['Market Brain', 'Sector Brain'];

  constructor(config = {}) {
    super('Relative Strength Brain', {
      weight: 0.9,
      enabled: true,
      timeHorizon: 'intraday',
      ...config,
    });
  }

  async analyze(context) {
    const reasons = [];
    const warnings = [];
    const metrics = {};

    const features = context.features || {};
    const symbolData = context.symbolData || {};

    const changePct = features.changePct || 0;
    const spyChange = features.spyChange || 0;
    const sectorStrength = features.sectorStrength || 0.5;

    let score = 50;
    let confidence = 60;

    // 1. Relative Strength vs SPY
    const rsSpy = changePct - spyChange;

    if (rsSpy > 2) {
      score += 25;
      confidence += 15;
      reasons.push(`✅ أقوى من SPY بنسبة ${rsSpy.toFixed(1)}%`);
    } else if (rsSpy > 1) {
      score += 18;
      confidence += 10;
      reasons.push(`📊 أفضل من SPY بنسبة ${rsSpy.toFixed(1)}%`);
    } else if (rsSpy > 0) {
      score += 10;
      confidence += 5;
      reasons.push(`📊 متوافق مع SPY`);
    } else {
      warnings.push(`⚠️ أضعف من SPY بنسبة ${Math.abs(rsSpy).toFixed(1)}%`);
      score -= 10;
      confidence -=

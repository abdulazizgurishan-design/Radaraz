// lib/radar/core/AdaptiveModels.js — v17
export class AdaptiveModels {
  constructor(config = {}) {
    this.config = {
      models: {
        mega_cap: {
          minMarketCap: 200_000_000_000,
          weights: {
            earlyAccumulation: 0.20,
            breakoutProbability: 0.20,
            structure: 0.25,
            liquidity: 0.15,
            marketContext: 0.15,
            sectorStrength: 0.05,
          },
          minConfidence: 70,
          minScore: 65,
        },
        large_cap: {
          minMarketCap: 10_000_000_000,
          maxMarketCap: 200_000_000_000,
          weights: {
            earlyAccumulation: 0.25,
            breakoutProbability: 0.25,
            structure: 0.20,
            liquidity: 0.15,
            marketContext: 0.10,
            sectorStrength: 0.05,
          },
          minConfidence: 65,
          minScore: 60,
        },
        mid_cap: {
          minMarketCap: 2_000_000_000,
          maxMarketCap: 10_000_000_000,
          weights: {
            earlyAccumulation: 0.30,
            breakoutProbability: 0.25,
            structure: 0.15,
            liquidity: 0.15,
            marketContext: 0.10,
            sectorStrength: 0.05,
          },
          minConfidence: 60,
          minScore: 55,
        },
        small_cap: {
          minMarketCap: 300_000_000,
          maxMarketCap: 2_000_000_000,
          weights: {
            earlyAccumulation: 0.35,
            breakoutProbability: 0.25,
            structure: 0.10,
            liquidity: 0.20,
            marketContext: 0.05,
            sectorStrength: 0.05,
          },
          minConfidence: 55,
          minScore: 50,
        },
        micro_cap: {
          maxMarketCap: 300_000_000,
          weights: {
            earlyAccumulation: 0.40,
            breakoutProbability: 0.20,
            structure: 0.05,
            liquidity: 0.30,
            marketContext: 0.05,
            sectorStrength: 0.00,
          },
          minConfidence: 50,
          minScore: 45,
        },
      },
      ...config,
    };
  }

  getModel(marketCap) {
    const models = this.config.models;
    if (marketCap >= models.mega_cap.minMarketCap) return models.mega_cap;
    if (marketCap >= models.large_cap.minMarketCap) return models.large_cap;
    if (marketCap >= models.mid_cap.minMarketCap) return models.mid_cap;
    if (marketCap >= models.small_cap.minMarketCap) return models.small_cap;
    return models.micro_cap;
  }

  getAdaptiveWeights(marketCap, baseWeights) {
    const model = this.getModel(marketCap);
    const weights = { ...baseWeights };

    for (const key of Object.keys(weights)) {
      if (model.weights[key] !== undefined) {
        weights[key] = model.weights[key];
      }
    }

    // تطبيع الأوزان
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(weights)) {
      weights[key] = weights[key] / total;
    }

    return weights;
  }

  getAdaptiveThresholds(marketCap) {
    const model = this.getModel(marketCap);
    return {
      minConfidence: model.minConfidence,
      minScore: model.minScore,
    };
  }

  getModelName(marketCap) {
    const model = this.getModel(marketCap);
    const models = this.config.models;
    for (const [name, m] of Object.entries(models)) {
      if (m === model) return name;
    }
    return 'unknown';
  }
}

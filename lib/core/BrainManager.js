// lib/radar/core/BrainManager.js
export class BrainManager {
  constructor() {
    this.brains = [];
    this.results = new Map();
    this.executionOrder = [];
  }

  register(brain) {
    if (!brain || typeof brain.analyze !== 'function') {
      throw new Error('Invalid brain: must implement analyze()');
    }
    this.brains.push(brain);
    return this;
  }

  registerAll(brains) {
    for (const brain of brains) {
      this.register(brain);
    }
    return this;
  }

  // حساب ترتيب التنفيذ بناءً على Dependencies
  resolveDependencies() {
    const graph = {};
    const inDegree = {};
    const allBrains = {};

    for (const brain of this.brains) {
      const name = brain.name;
      allBrains[name] = brain;
      inDegree[name] = 0;
      graph[name] = [];
    }

    for (const brain of this.brains) {
      const deps = brain.constructor.dependencies || [];
      for (const dep of deps) {
        if (allBrains[dep]) {
          graph[dep].push(brain.name);
          inDegree[brain.name] = (inDegree[brain.name] || 0) + 1;
        }
      }
    }

    // ترتيب طوبولوجي (Topological Sort)
    const queue = [];
    for (const [name, deg] of Object.entries(inDegree)) {
      if (deg === 0) queue.push(name);
    }

    const order = [];
    const visited = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      order.push(current);

      for (const next of graph[current] || []) {
        inDegree[next]--;
        if (inDegree[next] === 0) {
          queue.push(next);
        }
      }
    }

    // التحقق من وجود دورات
    if (order.length !== this.brains.length) {
      const missing = this.brains.map(b => b.name).filter(n => !visited.has(n));
      throw new Error(`Cycle detected in dependencies: ${missing.join(', ')}`);
    }

    this.executionOrder = order;
    return order;
  }

  async analyzeAll(context) {
    // حل التبعيات أولاً
    this.resolveDependencies();

    const results = {};
    const brainMap = {};
    for (const brain of this.brains) {
      brainMap[brain.name] = brain;
    }

    // تنفيذ بالترتيب
    for (const name of this.executionOrder) {
      const brain = brainMap[name];
      if (!brain || !brain.enabled) {
        results[name] = { enabled: false, score: 0 };
        continue;
      }

      // تأكد من توفر التبعيات
      const deps = brain.constructor.dependencies || [];
      const missingDeps = deps.filter(d => !results[d] || results[d].error);
      if (missingDeps.length > 0) {
        console.warn(`⚠️ ${name} skipped: missing dependencies ${missingDeps.join(', ')}`);
        results[name] = {
          error: `Missing dependencies: ${missingDeps.join(', ')}`,
          score: 0,
          confidence: 0,
        };
        continue;
      }

      const start = Date.now();
      try {
        const result = await brain.analyze(context);
        brain.executionTime = Date.now() - start;
        brain.lastResult = result;
        results[name] = result;
        this.results.set(name, result);
      } catch (error) {
        console.error(`❌ Brain ${name} failed:`, error.message);
        results[name] = {
          error: error.message,
          score: 0,
          confidence: 0,
          reasons: [],
          warnings: [`⚠️ Brain ${name} فشل: ${error.message}`],
          metrics: { error: true },
        };
      }
    }

    return results;
  }

  getResult(brainName) {
    return this.results.get(brainName) || null;
  }

  getEnabledBrains() {
    return this.brains.filter(b => b.enabled);
  }

  getDisabledBrains() {
    return this.brains.filter(b => !b.enabled);
  }

  getExecutionOrder() {
    return this.executionOrder;
  }

  analyzePerformance() {
    const performance = {};
    for (const brain of this.brains) {
      performance[brain.name] = {
        enabled: brain.enabled,
        weight: brain.weight,
        timeHorizon: brain.timeHorizon,
        avgScore: brain.lastResult?.score || 0,
        avgConfidence: brain.lastResult?.confidence || 0,
        avgExecutionTime: brain.executionTime,
        accuracy: brain.historicalAccuracy || null,
        dependencies: brain.constructor.dependencies || [],
      };
    }
    return performance;
  }
}

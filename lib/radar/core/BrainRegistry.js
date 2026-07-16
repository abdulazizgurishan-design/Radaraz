// lib/radar/core/BrainRegistry.js
export class BrainRegistry {
  constructor() {
    this.brains = new Map();
    this.metadata = new Map();
  }

  // تسجيل Brain يدوياً
  register(BrainClass, config = {}) {
    const instance = new BrainClass(config);
    const metadata = BrainClass.metadata || {
      id: instance.name.toLowerCase().replace(/\s/g, '_'),
      version: '1.0',
      author: 'RadarAZ',
      category: 'general',
      priority: 50,
    };

    this.brains.set(metadata.id, instance);
    this.metadata.set(metadata.id, { ...metadata, enabled: config.enabled !== false });
    return this;
  }

  registerAll(brainClasses) {
    for (const [BrainClass, config] of brainClasses) {
      this.register(BrainClass, config);
    }
    return this;
  }

  // الحصول على Brain
  get(id) {
    return this.brains.get(id) || null;
  }

  // الحصول على جميع الـ Brains
  getAll() {
    return Array.from(this.brains.values());
  }

  // الحصول على الـ Brains المفعّلة
  getEnabled() {
    const result = [];
    for (const [id, brain] of this.brains) {
      const meta = this.metadata.get(id);
      if (meta && meta.enabled !== false) {
        result.push(brain);
      }
    }
    return result;
  }

  // الحصول على Metadata
  getMetadata(id) {
    return this.metadata.get(id) || null;
  }

  // تعطيل Brain
  disable(id) {
    const meta = this.metadata.get(id);
    if (meta) {
      meta.enabled = false;
      this.metadata.set(id, meta);
      console.log(`⏸️ Disabled: ${id}`);
    }
  }

  // تفعيل Brain
  enable(id) {
    const meta = this.metadata.get(id);
    if (meta) {
      meta.enabled = true;
      this.metadata.set(id, meta);
      console.log(`▶️ Enabled: ${id}`);
    }
  }

  // الحصول على قائمة جميع الـ Brains
  list() {
    const result = [];
    for (const [id, meta] of this.metadata) {
      result.push({
        id,
        version: meta.version,
        author: meta.author,
        category: meta.category,
        priority: meta.priority,
        enabled: meta.enabled !== false,
      });
    }
    return result.sort((a, b) => (a.priority || 50) - (b.priority || 50));
  }
}

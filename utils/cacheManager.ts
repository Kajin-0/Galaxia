export interface CacheStats {
  name: string;
  size: number;
  maxSize: number;
  memoryEstimate: number; // KB
}

class CacheManager {
  private static instance: CacheManager;
  private caches = new Map<string, Map<any, any>>();
  private stats = new Map<string, CacheStats>();
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }
  
  registerCache(name: string, cache: Map<any, any>, maxSize: number) {
    this.caches.set(name, cache);
    this.stats.set(name, {
      name,
      size: cache.size,
      maxSize,
      memoryEstimate: 0
    });
  }
  
  cleanup() {
    for (const [name, cache] of this.caches) {
      const stats = this.stats.get(name)!;
      
      if (cache.size > stats.maxSize) {
        // Evict oldest keys first instead of clearing the whole cache.
        // Map iteration order is insertion order, so keys().next() is stable oldest-entry eviction.
        while (cache.size > stats.maxSize) {
          const oldestEntry = cache.keys().next();
          if (oldestEntry.done) break;
          cache.delete(oldestEntry.value);
        }
      }

      // Update stats after any cleanup work.
      stats.size = cache.size;
      stats.memoryEstimate = this.estimateMemory(cache);
    }
  }

  clearAll() {
    for (const cache of this.caches.values()) {
        cache.clear();
    }
  }
  
  private estimateMemory(cache: Map<any, any>): number {
    let totalKB = 0;
    for (const value of cache.values()) {
      if (value instanceof HTMLCanvasElement) {
        // Estimate canvas memory: width * height * 4 bytes (RGBA)
        totalKB += (value.width * value.height * 4) / 1024;
      } else if (Array.isArray(value)) {
        // Estimate array memory
        totalKB += (value.length * 32) / 1024; // Rough estimate
      } else {
        // Estimate object memory
        totalKB += 1; // Minimal estimate
      }
    }
    return Math.round(totalKB);
  }
  
  getStats(): CacheStats[] {
    // Update stats before returning them
    for (const [name, cache] of this.caches) {
        const stats = this.stats.get(name)!;
        stats.size = cache.size;
        stats.memoryEstimate = this.estimateMemory(cache);
    }
    return Array.from(this.stats.values());
  }
  
  logStats() {
    // Cache statistics available via getStats()
  }
}

export const cacheManager = CacheManager.getInstance();
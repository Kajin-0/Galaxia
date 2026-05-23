/**
 * Array Pool for reducing garbage collection pressure by reusing arrays
 * This is particularly useful for temporary arrays used in game loops
 */

export class ArrayPool<T> {
    private pools: Map<number, T[][]> = new Map();
    private maxPoolSize: number;

    constructor(maxPoolSize: number = 10) {
        this.maxPoolSize = maxPoolSize;
    }

    /**
     * Get an array from the pool or create a new one
     * @param initialCapacity Hint for the initial capacity
     * @returns A cleared array ready for use
     */
    get(initialCapacity: number = 0): T[] {
        const poolKey = Math.min(initialCapacity, 1000); // Group similar sizes
        let pool = this.pools.get(poolKey);
        
        if (!pool) {
            pool = [];
            this.pools.set(poolKey, pool);
        }

        if (pool.length > 0) {
            const arr = pool.pop()!;
            arr.length = 0; // Clear the array
            return arr;
        }

        return new Array<T>(initialCapacity);
    }

    /**
     * Return an array to the pool for reuse
     * @param arr The array to return
     */
    release(arr: T[]): void {
        if (!arr || arr.length > 1000) return; // Don't pool very large arrays
        
        const poolKey = Math.min(arr.length, 1000);
        let pool = this.pools.get(poolKey);
        
        if (!pool) {
            pool = [];
            this.pools.set(poolKey, pool);
        }

        if (pool.length < this.maxPoolSize) {
            arr.length = 0; // Clear the array
            pool.push(arr);
        }
    }

    /**
     * Clear all pools to free memory
     */
    clear(): void {
        this.pools.clear();
    }

}

/**
 * Specialized array pools for common game types
 * Only pools that are actually used are included to reduce memory footprint
 */
export const arrayPools = {
    // Game entity arrays (only these are actually used)
    tempEnemies: new ArrayPool<any>(15), // Using any to avoid circular imports
    tempProjectiles: new ArrayPool<any>(20),
};

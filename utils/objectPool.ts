/**
 * A generic object pool for recycling objects to reduce garbage collection overhead.
 */
export class ObjectPool<T> {
    private pool: T[] = [];
    private creator: () => T;

    /**
     * @param creator A function that creates a new object instance when the pool is empty.
     * @param initialSize The number of objects to pre-allocate in the pool.
     */
    constructor(creator: () => T, initialSize: number = 0) {
        this.creator = creator;
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.creator());
        }
    }

    /**
     * Retrieves an object from the pool, or creates a new one if the pool is empty.
     * The caller is responsible for initializing the object's properties.
     * @returns An object of type T.
     */
    get(): T {
        if (this.pool.length > 0) {
            return this.pool.pop()!;
        }
        return this.creator();
    }

    /**
     * Returns a single object to the pool for later reuse.
     * @param obj The object to release.
     */
    release(obj: T) {
        // In a more robust system, you might reset the object here,
        // but we'll let the getter's initializer handle it.
        this.pool.push(obj);
    }

    /**
     * Returns an array of objects to the pool. More efficient than calling release multiple times.
     * @param objs The array of objects to release.
     */
    releaseAll(objs: T[]) {
        this.pool.push(...objs);
    }
}

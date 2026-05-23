
import type { GameObject } from '../types';

/**
 * An interface for any object that can be inserted into the spatial grid.
 * It must have a position, an ID, and a radius.
 */
export interface Collidable extends GameObject {
    radius: number;
    _lastQueryId?: number; // Optimization: Tagging system to avoid Set allocations
}

/**
 * A spatial grid for optimizing collision detection.
 * It divides the game world into cells and stores objects in the cells they occupy.
 * This allows for quickly querying only nearby objects instead of all objects.
 */
export class SpatialGrid {
    private cells: Map<number, Collidable[]>;
    private cellSize: number;
    private width: number;
    private height: number;
    private nearbyResultCache: Collidable[] = [];
    
    // Optimization: Global counter to handle deduplication across multiple grid instances/frames
    private static globalQueryId = 0;

    constructor(width: number, height: number, cellSize: number) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    private getCellKey(col: number, row: number): number {
        // Use a simple hash: col * largeNumber + row
        // Assuming max 1000 columns, this is safe
        return col * 10000 + row;
    }

    private getCellIndices(obj: Collidable): { startCol: number; endCol: number; startRow: number; endRow: number; } {
        const { x, y, radius } = obj;
        // Calculate raw column indices (may be negative or beyond grid bounds)
        const rawStartCol = Math.floor((x - radius) / this.cellSize);
        const rawEndCol = Math.floor((x + radius) / this.cellSize);
        const rawStartRow = Math.floor((y - radius) / this.cellSize);
        const rawEndRow = Math.floor((y + radius) / this.cellSize);
        
        // Clamp to valid grid bounds, but ensure endCol >= startCol for valid loop ranges
        // This allows objects partially off-screen to still be inserted into overlapping cells
        const startCol = Math.max(0, Math.min(rawStartCol, this.width - 1));
        const endCol = Math.max(startCol, Math.min(rawEndCol, this.width - 1));
        const startRow = Math.max(0, Math.min(rawStartRow, this.height - 1));
        const endRow = Math.max(startRow, Math.min(rawEndRow, this.height - 1));
        
        return { startCol, endCol, startRow, endRow };
    }

    /**
     * Clears all objects from the grid. Should be called at the start of each frame.
     */
    public clear(): void {
        // Keep cell arrays allocated and just truncate them. This avoids
        // re-allocating many short-lived arrays every frame.
        for (const cell of this.cells.values()) {
            cell.length = 0;
        }
    }

    /**
     * Inserts an object into the grid. An object can be inserted into multiple cells if it overlaps them.
     * @param obj The object to insert.
     */
    public insert(obj: Collidable): void {
        const { startCol, endCol, startRow, endRow } = this.getCellIndices(obj);

        for (let c = startCol; c <= endCol; c++) {
            for (let r = startRow; r <= endRow; r++) {
                const key = this.getCellKey(c, r);
                let cell = this.cells.get(key);
                if (!cell) {
                    cell = [];
                    this.cells.set(key, cell);
                }
                cell.push(obj);
            }
        }
    }

    /**
     * Retrieves all potential collision candidates for a given object.
     * It returns all objects that are in the same cell(s) as the provided object.
     * Optimized to avoid Set allocations.
     * @param obj The object to find nearby candidates for.
     * @returns An array of nearby collidable objects.
     */
    public getNearby(obj: Collidable): Collidable[] {
        return this.getNearbyInto(obj, this.nearbyResultCache);
    }

    /**
     * Variant of getNearby that writes into a caller-provided array.
     * Useful for nested queries to avoid clobbering another active result set.
     */
    public getNearbyInto(obj: Collidable, output: Collidable[]): Collidable[] {
        // Increment global query ID for this search operation
        SpatialGrid.globalQueryId++;
        const currentQueryId = SpatialGrid.globalQueryId;
        
        const { startCol, endCol, startRow, endRow } = this.getCellIndices(obj);
        
        output.length = 0;

        for (let c = startCol; c <= endCol; c++) {
            for (let r = startRow; r <= endRow; r++) {
                const key = this.getCellKey(c, r);
                const cell = this.cells.get(key);
                if (cell) {
                    // Manual loop is faster than for...of or forEach
                    for (let i = 0; i < cell.length; i++) {
                        const item = cell[i];
                        // Deduplicate: Check if we've already added this item in this query
                        // We use the tagged property on the object itself (zero allocation)
                        if (item.id !== obj.id && item._lastQueryId !== currentQueryId) {
                            item._lastQueryId = currentQueryId;
                            output.push(item);
                        }
                    }
                }
            }
        }
        
        return output;
    }
}


import type { GameObject } from '../types';

/**
 * An interface for any object that can be inserted into the spatial grid.
 * It must have a position, an ID, and a radius.
 */
export interface Collidable extends GameObject {
    radius: number;
}

/**
 * A spatial grid for optimizing collision detection.
 * It divides the game world into cells and stores objects in the cells they occupy.
 * This allows for quickly querying only nearby objects instead of all objects.
 */
export class SpatialGrid {
    private cells: Map<string, Collidable[]>;
    private cellSize: number;
    private width: number;
    private height: number;

    constructor(width: number, height: number, cellSize: number) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cells = new Map();
    }

    private getCellKey(col: number, row: number): string {
        return `${col},${row}`;
    }

    private getCellIndices(obj: Collidable): { startCol: number; endCol: number; startRow: number; endRow: number; } {
        const { x, y, radius } = obj;
        const startCol = Math.floor(Math.max(0, x - radius) / this.cellSize);
        const endCol = Math.floor(Math.min(this.width - 1, x + radius) / this.cellSize);
        const startRow = Math.floor(Math.max(0, y - radius) / this.cellSize);
        const endRow = Math.floor(Math.min(this.height - 1, y + radius) / this.cellSize);
        return { startCol, endCol, startRow, endRow };
    }

    /**
     * Clears all objects from the grid. Should be called at the start of each frame.
     */
    public clear(): void {
        this.cells.clear();
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
                if (!this.cells.has(key)) {
                    this.cells.set(key, []);
                }
                this.cells.get(key)!.push(obj);
            }
        }
    }

    /**
     * Retrieves all potential collision candidates for a given object.
     * It returns all objects that are in the same cell(s) as the provided object.
     * @param obj The object to find nearby candidates for.
     * @returns An array of nearby collidable objects.
     */
    public getNearby(obj: Collidable): Collidable[] {
        const nearby = new Set<Collidable>();
        const { startCol, endCol, startRow, endRow } = this.getCellIndices(obj);

        for (let c = startCol; c <= endCol; c++) {
            for (let r = startRow; r <= endRow; r++) {
                const key = this.getCellKey(c, r);
                if (this.cells.has(key)) {
                    this.cells.get(key)!.forEach(item => {
                        // Don't check an object against itself
                        if (item.id !== obj.id) {
                            nearby.add(item);
                        }
                    });
                }
            }
        }
        return Array.from(nearby);
    }
}

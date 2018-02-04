import Emitter from '../lib/emitter'

import {GridStateEnum as gse} from 'common'
import {ClassicGenerator} from 'generator'

/**
 * Game engine class, containing decoupled game logic.
 *
 * @class
 * @extends Emitter
 * @property {number} w - Width of minefield
 * @property {number} h - Height of minefield
 * @property {number} n - Number of mines
 * @property {RNG | string | number | null} seed - RNG or seed used to create minefield
 * @property {boolean} dead - Player is dead
 * @property {boolean} won - Player has won
 *
 * @property {Array<number>} mines - Map of mine locations. Don't cheat!
 * @property {Array<number>} grid - Game state grid
 */
export class GameState extends Emitter {
    constructor(height = 16, width = 30, mines = 99, seed = null) {
        super()

        this.w = width
        this.h = height
        this.n = mines
        this.seed = seed
        this.dead = false
        this.won = false

        this.mines = null
        this.grid = []
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++)
                this.grid[y * width + x] = -2
        }
    }

    /**
     * Uncover a square in the minefield.
     *
     * @param x - X coordinate to open, from left
     * @param y - Y coordinate to open, from top
     * @returns {boolean} Game is still ongoing
     */
    open(x, y) {
        const w = this.w, h = this.h
        if (!(0 <= x && x < w) || !(0 <= y && y < h))
            throw new Error('coordinate(s) out of range')

        if (this.mines == null) {
            /*
	         * We have a preliminary game in which the mine layout
	         * hasn't been generated yet. Generate it based on the
	         * initial click location.
	         */
            this.mines = ClassicGenerator.generate(h, w, this.n, x, y, this.seed)
            this.emit('start')
        }

        if (this.mines[y * w + x]) {
            /*
	         * The player has landed on a mine. Bad luck. Expose the
	         * mine that killed them, but not the rest (in case they
	         * want to Undo and carry on playing).
	         */
            this.dead = true
            this.grid[y * w + x] = gse.MineClicked
            this.emit('end', false)
            return false
        }

        /*
         * Otherwise, the player has opened a safe square. Mark it to-do.
         */
        const queue = []
        //this.grid[y * w + x] = -10 /* queue value internal to this func */
        queue.push({x, y})

        /*
         * Now go through the queue and open the squares.
         * Every time one of them turns out to have no
         * neighbouring mines, we add all its unopened neighbours to
         * the list as well.
         *
         * Different from the best-case(!) O(N²) in the original.
         */
        for (let q = 0; q < queue.length; q++) {
            const {x: xx, y: yy} = queue[q]

            if (this.mines[yy * w + xx])
                throw new Error('tried to auto-clear a mine')

            let v = 0

            for (let dx = -1; dx <= +1; dx++) {
                for (let dy = -1; dy <= +1; dy++) {
                    if (xx + dx >= 0 && xx + dx < w
                        && yy + dy >= 0 && yy + dy < h
                        && this.mines[(yy + dy) * w + (xx + dx)])
                        v++
                }
            }

            this.grid[yy * w + xx] = v

            if (v === 0) {
                for (let dx = -1; dx <= +1; dx++) {
                    for (let dy = -1; dy <= +1; dy++) {
                        if (xx + dx >= 0 && xx + dx < w
                            && yy + dy >= 0 && yy + dy < h
                            && this.grid[(yy + dy) * w + (xx + dx)] === gse.Unknown)
                            queue.push({x: xx + dx, y: yy + dy})
                    }
                }
            }
        }

        /*
         * Finally, scan the grid and see if exactly as many squares
         * are still covered as there are mines. If so, set the `won'
         * flag and fill in mine markers on all covered squares.
         */
        let nmines = 0, ncovered = 0
        for (let yy = 0; yy < h; yy++) {
            for (let xx = 0; xx < w; xx++) {
                if (this.grid[yy * w + xx] < 0)
                    ncovered++
                if (this.mines[yy * w + xx])
                    nmines++
            }
        }
        if (ncovered < nmines)
            throw new Error('uncovered a mine without losing?')
        if (ncovered === nmines) {
            for (let yy = 0; yy < h; yy++) {
                for (let xx = 0; xx < w; xx++) {
                    if (this.grid[yy * w + xx] < 0)
                        this.grid[yy * w + xx] = gse.Flag
                }
            }
            this.won = true
            this.emit('end', true)
            return false
        }

        return true
    }
}

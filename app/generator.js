import xor4096 from '../lib/xor4096'
import {Solver} from 'solver'

/**
 * Interface for classes that generate minefields
 *
 * @interface MinefieldGenerator
 */
/**
 * Generate a new minefield with the given parameters.
 *
 * @function
 * @static
 * @name MinefieldGenerator#generate
 * @param {number} height Height of minefield.
 * @param {number} width - Width of minefield.
 * @param {number} mines - Number of mines.
 * @param {number} x - First click x-coordinate (to avoid immediate mine).
 * @param {number} y - First click y-coordinate (to avoid immediate mine).
 * @param {RNG | string | number} [seed] - Seed for generating minefield.
 * @returns {Array<number>} An array containing the minefield.
 */

/**
 * Generates classic MS minefields.
 * Based on Simon Tatham's https://www.chiark.greenend.org.uk/~sgtatham/puzzles/js/mines.html.
 *
 * @class
 * @implements {MinefieldGenerator}
 */
export class ClassicGenerator {
    static generate(height, width, mines, x, y, seed) {
        if (mines > (width * height - 9))
            throw new Error('too many mines for grid size')
        const ret = memset(0, width * height)
        const rng = (seed == null || seed.uint32_range == null) ? xor4096(seed) : seed

        /*
	     * Start by placing n mines, none of which is at x,y or within
	     * one square of it.
	     */
        const tmp = memset(0, width * height)

        /*
	     * Write down the list of possible mine locations.
	     */
        let k = 0
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                if (Math.abs(i - y) > 1 || Math.abs(j - x) > 1)
                    tmp[k++] = i * width + j
            }
        }

        /*
         * Now pick n off the list at random.
         */
        let nn = mines
        while (nn-- > 0) {
            const i = rng.uint32_range(k)
            ret[tmp[i]] = 1
            tmp[i] = tmp[--k]
        }

        return ret
    }
}

/**
 * Generates fair minefields without guessing, using Simon Tathams solver.
 *
 * @class
 * @implements {MinefieldGenerator}
 */
export class FairGenerator extends ClassicGenerator {
    static generate(height, width, mines, x, y, seed) {
        if (width <= 2 || height <= 2)
            throw new Error('grid dimensions must be at least 3x3')
        const rng = typeof seed !== 'object' ? xor4096(seed) : seed

        let ret, success, ntries = 0
        do {
            success = false
            ntries++

            ret = super.generate(height, width, mines, x, y, rng)

            /*
	         * Now set up a results grid to run the solver in, and a
	         * context for the solver to open squares. Then run the solver
	         * repeatedly; if the number of perturb steps ever goes up or
	         * it ever returns -1, give up completely.
             */
            const solver = new Solver(
                ret, width, height, mines, x, y, rng, ntries > 100)
            let solveret, prevret = -2 // FIXME tf is going on with prevret
            for (;;) {
                solver.state = memset(-2, width * height)
                solver.state[y * width + x] = solver.open(x, y)
                if (solver.state[y * width + x] !== 0)
                    throw new Error('Generation broken, first square not empty')
                solveret = solver.solve()
                if (solveret < 0 || (prevret >= 0 && solveret >= prevret)) {
                    success = false
                    break
                } else if (solveret === 0) {
                    success = true
                    break
                }
            }
        } while (!success)

        return ret
    }
}

function memset(n, len) {
    const ret = []
    for (let i = 0; i < len; i++)
        ret[i] = n
    return ret
}

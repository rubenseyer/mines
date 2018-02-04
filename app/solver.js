class Solver {
    constructor(grid, w, h, n, sx, sy, rng, allow_big_perturbs) {
        this.grid = grid
        this.w = w
        this.h = h
        this.n = n
        this.state = []
        this.sx = sx
        this.sy = sy
        this.rng = rng
        this.allow_big_perturbs = allow_big_perturbs
    }

    open(x, y) {
        if (!(x >= 0 && x < this.w && y >= 0 && y < this.h))
            throw new Error('coordinates out of range')
        if (this.grid[y * this.w + x])
            return -1 /* *bang* */

        let n = 0
        for (let i = -1; i <= +1; i++) {
            if (x + i < 0 || x + i >= this.w)
                continue
            for (let j = -1; j <= +1; j++) {
                if (y + j < 0 || y + j >= this.h)
                    continue
                if (i === 0 && j === 0)
                    continue
                if (this.grid[(y + j) * this.w + (x + i)])
                    n++
            }
        }

        return n
    }

    solve() {
        return 0 // TODO FIXME
    }
}

export {Solver}

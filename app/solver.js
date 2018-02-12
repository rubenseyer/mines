class Solver {
    constructor(grid, w, h, n, sx, sy, rng, allow_big_perturbs) {
        this.grid = grid
        this.w = w
        this.h = h
        this.n = n
        this.state = []
        this.sx = sx
        this.sy = sy
        /** @type {RNG} **/
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
        /**
         * @type {{sets: SolveSet[], todo: SolveSet[]}}
         */
        const ss = {
            sets: [],
            todo: [],
        }
        let nperturbs = 0
        /*
         * Set up a list of squares with known contents, so that
         * we can process them one by one.
         */
        const std = []

        /*
         * Initialise that list with all known squares in the input
         * grid.
         */
        for (let i = 0; i < this.w * this.h; i++) {
            if (this.state[i] !== -2)
                std.push(i)
        }

        /*
         * Main deductive loop.
         */
        for (;;) {
            console.log(this._dump())
            let done_something = false

            /*
             * If there are any known squares on the to-do list, process
             * them and construct a set for each.
             */
            while (std.length > 0) {
                const i = std.shift()
                const x = i % this.w
                const y = ~~(i / this.w)
                console.log(`known square at ${x},${y} [${this.state[i]}]`)

                if (this.state[i] >= 0) {
                    console.log('creating set around this square')
                    /*
                     * Empty square. Construct the set of non-known squares
                     * around this one, and determine its mine count.
                     */
                    let mines = this.state[i]
                    let bit = 1, val = 0
                    for (let dy = -1; dy <= +1; dy++) {
                        for (let dx = -1; dx <= +1; dx++) {
                            console.log(`grid ${x + dx},${y + dy} = ${this.state[i + dy * this.w + dx]}`)
                            if (x + dx < 0 || x + dx >= this.w || y + dy < 0 || y + dy >= this.h)
                                console.log('skip') // ignore this one
                            else if (this.state[i + dy * this.w + dx] === -1)
                                mines--
                            else if (this.state[i + dy * this.w + dx] === -2)
                                val |= bit
                            bit <<= 1
                        }
                    }
                    if (val)
                        ss_add(ss, x - 1, y - 1, val, mines)
                }

                /*
                 * Now, whether the square is empty or full, we must
                 * find any set which contains it and replace it with
                 * one which does not.
                 */
                console.log(`finding sets containing known square ${x},${y}`)
                const list = ss_overlap(ss, x, y, 1)

                for (const s of list) {
                    /*
                     * Compute the mask for this set minus the
                     * newly known square.
                     */
                    const newmask = setmunge(s, {x, y, mask: 1}, true)

                    /*
                     * Compute the new mine count.
                     */
                    const newmines = s.mines - (this.state[i] === -1)

                    /*
                     * Insert the new set into the collection,
                     * unless it's been whittled right down to
                     * nothing.
                     */
                    if (newmask)
                        ss_add(ss, s.x, s.y, newmask, newmines)

                    ss_remove(ss, s)
                }

                /*
                 * Marking a fresh square as known certainly counts as
                 * doing something.
                 */
                done_something = true
            }

            /*
             * Now pick a set off the to-do list and attempt deductions
             * based on it.
             */
            if (ss.todo.length > 0) {
                const s = ss.todo.shift()
                console.log(`set to do: ${s.x},${s.y} ${s.mask.toString(2)} ${s.mines}`)

                /*
                 * Firstly, see if this set has a mine count of zero or
                 * of its own cardinality.
                 */
                if (s.mines === 0 || s.mines === bitcount16(s.mask)) {
                    /*
                     * If so, we can immediately mark all the squares
                     * in the set as known.
                     */
                    console.log('easy')
                    this.known_squares(std, s.x, s.y, s.mask, s.mines !== 0)

                    /*
                     * Having done that, we need do nothing further
                     * with this set; marking all the squares in it as
                     * known will eventually eliminate it, and will
                     * also permit further deductions about anything
                     * that overlaps it.
                     */
                    continue
                }

                /*
                 * Failing that, we now search through all the sets
                 * which overlap this one.
                 */
                for (const s2 of ss_overlap(ss, s.x, s.y, s.mask)) {
                    /*
                     * Find the non-overlapping parts s2-s and s-s2,
                     * and their cardinalities.
                     *
                     * I'm going to refer to these parts as `wings'
                     * surrounding the central part common to both
                     * sets. The `s wing' is s-s2; the `s2 wing' is
                     * s2-s.
                     */
                    const swing = setmunge(s, s2, true)
                    const s2wing = setmunge(s2, s, true)
                    const swc = bitcount16(swing)
                    const s2wc = bitcount16(s2wing)

                    /*
                     * If one set has more mines than the other, and
                     * the number of extra mines is equal to the
                     * cardinality of that set's wing, then we can mark
                     * every square in the wing as a known mine, and
                     * every square in the other wing as known clear.
                     */
                    if (swc === s.mines - s2.mines || s2wc === s2.mines - s.mines) {
                        this.known_squares(std, s.x, s.y, swing, swc === s.mines - s2.mines)
                        this.known_squares(std, s2.x, s2.y, s2wing, s2wc === s2.mines - s.mines)
                        continue
                    }

                    /*
                     * Failing that, see if one set is a subset of the
                     * other. If so, we can divide up the mine count of
                     * the larger set between the smaller set and its
                     * complement, even if neither smaller set ends up
                     * being immediately clearable.
                     */
                    if (swc === 0 && s2wc !== 0) {
                        /* s is a subset of s2. */
                        if (s2.mines <= s.mines)
                            throw new Error('s should be a subset of s2')
                        ss_add(ss, s2.x, s2.y, s2wing, s2.mines - s.mines)
                    } else if (s2wc === 0 && swc !== 0) {
                        /* s2 is a subset of s */
                        if (s.mines <= s2.mines)
                            throw new Error('s2 should be a subset of s')
                        ss_add(ss, s.x, s.y, swing, s.mines - s2.mines)
                    }
                }

                /*
                 * In this situation we have definitely done,
                 * _something_, even if it's only reducing the size of
                 * or to-do list.
                 */
                done_something = true
            } else if (this.n >= 0) {
                /*
                 * We have nothing left on our to-do list, which means
                 * all localised deductions have failed. Our next step
                 * is to resort to global deduction based on the total
                 * mine count. This is computationally expensive
                 * compared to any of the above deductions, which is
                 * why we only ever do it when all else fails, so that
                 * hopefully it won't have to happen too often.
                 *
                 * If you pass n<0 into this solver, that informs it
                 * that you do not know the total mine count, so it
                 * won't even attempt these deductions.
                 */

                /*
                 * Start by scanning the current grid state to work out
                 * how many unknown square we still have, and how many
                 * mines are to be placed in them.
                 */
                let squaresleft = 0, minesleft = this.n
                for (let i = 0; i < this.w * this.h; i++) {
                    if (this.state[i] === -1)
                        minesleft--
                    else if (this.state[i] === -2)
                        squaresleft++
                }

                console.log(`global deduction time: squaresleft=${squaresleft} minesleft=${minesleft}`)
                console.log(this._dump())

                /*
                 * If there _are_ no unknown square, we have actually
                 * finished.
                 */
                if (squaresleft === 0) {
                    if (minesleft !== 0)
                        throw new Error('no squares left but mines remaining')
                    break
                }

                /*
                 * First really simple case: if there are no more mines
                 * left, or if there are exactly as many mines left as
                 * squares to play them in, then it's all easy.
                 */
                if (minesleft === 0 || minesleft === squaresleft) {
                    for (let y = 0; y < this.h; y++) {
                        for (let x = 0; x < this.w; x++) {
                            if (this.state[y * this.w + x] === -2)
                                this.known_squares(std, x, y, 1, minesleft !== 0)
                        }
                    }
                }


                /*
                 * Failing that, we have to do some _real_ work.
                 * Ideally what we do here is to try every single
                 * combination of the currently available sets, in an
                 * attempt to find a disjoint union (i.e. a set of
                 * squares with a known mine count between them) such
                 * that the remaining unknown squares _not_ contained
                 * in that union either contain no mines or are all
                 * mines.
                 *
                 * Actually enumerating all 2^n possibilities will get
                 * a bit slow for large n, so I artificially cap this
                 * recursion at n=10 to avoid too much pain.
                 */
                const nsets = ss.sets.length
                if (nsets <= 10) {
                    /*
                     * Doing this with actual recursive function calls
                     * would get fiddly because a load of local
                     * variables from this function would have to be
                     * passed down through the recursion. So instead
                     * I'm going to use a virtual recursion within this
                     * function. The way this works is:
                     *
                     *  - we have an array `setused', such that
                     *    setused[n] is false or true depending on whether set
                     *    n is currently in the union we are
                     *    considering.
                     *
                     *  - we have a value `cursor' which indicates how
                     *    much of `setused' we have so far filled in.
                     *    It's conceptually the recursion depth.
                     *
                     * We begin by setting `cursor' to zero. Then:
                     *
                     *  - if cursor can advance, we advance it by one.
                     *    We set the value in `setused' that it went
                     *    past to 1 if that set is disjoint from
                     *    anything else currently in `setused', or to 0
                     *    otherwise.
                     *
                     *  - If cursor cannot advance because it has
                     *    reached the end of the setused list, then we
                     *    have a maximal disjoint union. Check to see
                     *    whether its mine count has any useful
                     *    properties. If so, mark all the squares not
                     *    in the union as known and terminate.
                     *
                     *  - If cursor has reached the end of setused and
                     *    the algorithm _hasn't_ terminated, back
                     *    cursor up to the nearest 1, turn it into a 0
                     *    and advance cursor just past it.
                     *
                     *  - If we attempt to back up to the nearest 1 and
                     *    there isn't one at all, then we have gone
                     *    through all disjoint unions of sets in the
                     *    list and none of them has been helpful, so we
                     *    give up.
                     */
                    const setused = []
                    let cursor = 0
                    for (;;) {
                        if (cursor < nsets) {
                            let ok = true

                            /* See if any existing set overlaps this one. */
                            for (let i = 0; i < cursor; i++) {
                                if (setused[i] && setmunge(ss.sets[cursor], ss.sets[i], false)) {
                                    ok = false
                                    break
                                }
                            }

                            if (ok) {
                                /*
                                 * We're adding this set to our union,
                                 * so adjust minesleft and squaresleft
                                 * appropriately.
                                 */
                                minesleft -= ss.sets[cursor].mines
                                squaresleft -= bitcount16(ss.sets[cursor].mask)
                            }

                            setused[cursor++] = ok
                        } else {
                            console.log(`trying a set combination with ${squaresleft} ${minesleft}`)

                            /*
                             * We've reached the end. See if we've got
                             * anything interesting.
                             */
                            if (squaresleft > 0 && (minesleft === 0 || minesleft === squaresleft)) {
                                /*
                                 * We have! There is at least one
                                 * square not contained within the set
                                 * union we've just found, and we can
                                 * deduce that either all such squares
                                 * are mines or all are not (depending
                                 * on whether minesleft == 0). So now all
                                 * we have to do is actually go through
                                 * the grid, find those squares, and
                                 * mark them.
                                 */
                                for (let i = 0; i < this.w * this.h; i++) {
                                    if (this.state[i] === -2) {
                                        let outside = true
                                        const x = i % this.w
                                        const y = ~~(i / this.w)
                                        for (let j = 0; j < nsets; j++) {
                                            if (setused[j] && setmunge(ss.sets[j], {x, y, mask: 1}, false)) {
                                                outside = false
                                                break
                                            }
                                        }
                                        if (outside)
                                            this.known_squares(std, x, y, 1, minesleft !== 0)
                                    }
                                }

                                done_something = true
                                break /* return to main deductive loop */
                            }

                            /*
                             * If we reach here, then this union hasn't
                             * done us any good, so move on to the
                             * next. Backtrack cursor to the nearest true,
                             * change it to a false and continue.
                             */
                            while (!setused[cursor] && cursor >= 0)
                                cursor--

                            if (cursor >= 0) {
                                if (!setused[cursor])
                                    throw new Error('backtrack did not go to a true')
                                /*
                                 * We're removing this set from our
                                 * union, so re-increment minesleft and
                                 * squaresleft.
                                 */
                                minesleft += ss.sets[cursor].mines
                                squaresleft += bitcount16(ss.sets[cursor].mask)

                                setused[cursor++] = false
                            } else {
                                /*
                                 * We've backtracked all they way to the
                                 * start without finding a single 1,
                                 * which means that our virtual
                                 * recursion is complete and nothing
                                 * helped.
                                 */
                                break
                            }
                        }
                    }
                }
            }

            if (done_something)
                continue

            console.log(`solver ran out of steam, ret=${nperturbs}, grid:`)
            console.log(this._dump())
            for (const s of ss.sets)
                console.log(`remaining set: ${s.x},${s.y} ${s.mask.toString(2)} ${s.mines}`)

            /*
             * Now we really are at our wits' end as far as solving
             * this grid goes. Our only remaining option is to call
             * a perturb function and ask it to modify the grid to
             * make it easier.
             */
            if (this.perturb) {
                let ret = null
                nperturbs++

                /*
                 * Choose a set at random from the current selection,
                 * and ask the perturb function to either fill or empty
                 * it.
                 *
                 * If we have no sets at all, we must give up.
                 */
                if (ss.sets.length === 0) {
                    console.log('perturbing on entire unknown set')
                    ret = this.perturb(0, 0, 0)
                } else {
                    const s = ss.sets[this.rng.uint32_range(ss.sets.length)]
                    console.log(`perturbing on set ${s.x},${s.y} ${s.mask.toString(2)}`)
                    ret = this.perturb(s.x, s.y, s.mask)
                }

                if (ret != null) {
                    if (ret.n <= 0)
                        throw new Error('ret should have been null')

                    /*
                     * A number of squares have been fiddled with, and
                     * the returned structure tells us which. Adjust
                     * the mine count in any set which overlaps one of
                     * those squares, and put them back on the to-do
                     * list, Also, if the square itself is marked as a
                     * known non-mine, put it back on the squares-to-do
                     * list.
                     */
                    for (let i = 0; i < ret.n; i++) {
                        // eslint-disable-next-line max-len
                        console.log(`perturbation ${ret.changes[i].delta > 0 ? 'added' : 'removed'} mine at ${ret.changes[i].x},${ret.changes[i].y}`)

                        if (ret.changes[i].delta < 0 && this.state[ret.changes[i].y * this.w + ret.changes[i].x] !== -2)
                            std.push(ret.changes[i].y * this.w + ret.changes[i].x)

                        for (const s of ss_overlap(ss, ret.changes[i].x, ret.changes[i].y, 1))
                            ss.todo.push(s)
                    }

                    console.log('state after perturbation:')
                    console.log(this._dump())
                    for (const s of ss.sets)
                        console.log(`remaining set: ${s.x},${s.y} ${s.mask.toString(2)} ${s.mines}`)

                    continue
                }
            }

            /*
             * If we get here, even that didn't work, so we give up entirely.
             */
            break
        }

        /*
         * See if we've got any unknown squares left.
         */
        for (let i = 0; i < this.w * this.h; i++) {
            if (this.state[i] === -2) {
                nperturbs = -1
                break
            }
        }

        return nperturbs
    }

    known_squares(std, x, y, mask, mine) {
        console.log(`adding known squares ${x},${y} ${mine} ${_strmask(mask)}`)
        let bit = 1
        for (let yy = 0; yy < 3; yy++) {
            for (let xx = 0; xx < 3; xx++) {
                if (mask & bit) {
                    const i = (y + yy) * this.w + (x + xx)

                    /*
                     * It's possible that this square is _already_
                     * known, in which case we don't try to add it to
                     * the list twice.
                     */
                    if (this.state[i] === -2) {
                        if (mine) {
                            this.state[i] = -1 // flag
                            console.log(`flagged ${x + xx},${y + yy}`)
                        } else {
                            this.state[i] = this.open(x + xx, y + yy)
                            if (this.state[i] === -1)
                                throw new Error('*bang*')
                            console.log(`opened ${x + xx},${y + yy} [${this.state[i]}]`)
                        }
                        std.push(i)
                    }
                }
                bit <<= 1
            }
        }
    }

    //perturb() {}

    _dump() {
        let rv = ''
        for (let y = 0; y < this.h; y++) {
            for (let x = 0; x < this.w; x++) {
                const v = this.state[y * this.w + x]
                if (v === -1)
                    rv += '*'
                else if (v === -2)
                    rv += '?'
                else if (v === 0)
                    rv += '-'
                else
                    rv += '' + v
            }
            rv += '\n'
        }
        return rv
    }
}

/* eslint-disable no-param-reassign */
/**
 * @private
 * @typedef {object} SolveSet
 * @property {number} x
 * @property {number} y
 * @property {number} mask
 * @property {number} mines
 */
/**
 * @param lh {SolveSet}
 * @param rh {SolveSet}
 * @private
 */
function _setcmp(lh, rh) {
    if (lh.y < rh.y)
        return -1
    else if (lh.y > rh.y)
        return +1
    else if (lh.x < rh.x)
        return -1
    else if (lh.x > rh.x)
        return +1
    else if (lh.mask < rh.mask)
        return -1
    else if (lh.mask > rh.mask)
        return +1
    return 0
}

function _setindexof_ge(arr, val) {
    let low = 0, high = arr.length
    while (low < high) {
        const mid = (low + high) >>> 1
        if (_setcmp(arr[mid], val) === -1)
            low = mid + 1
        else
            high = mid
    }
    return low
}

function _addsetsorted(arr, val) {
    const i = _setindexof_ge(arr, val)
    if (arr[i] != null && _setcmp(arr[i], val) === 0)
        return false
    arr.splice(i, 0, val)
    return true
}

function ss_add(ss, x, y, mask, mines) {
    if (mask === 0)
        throw new Error('ss_add assertion failed')
    while (!(mask & (1 | 8 | 64))) {
        mask >>= 1
        x++
    }
    while (!(mask & (1 | 2 | 4))) {
        mask >>= 3
        y++
    }
    const s = {x, y, mask, mines}
    if (!_addsetsorted(ss.sets, s))
        return
    console.log(`added set ${x},${y} ${mask.toString(2)} ${mines}`)
    ss.todo.push(s)
}

function ss_remove(ss, s) {
    console.log(`removing set ${s.x},${s.y} ${s.mask.toString(2)}`)
    const todoi = ss.todo.indexOf(s)
    if (todoi > -1)
        ss.todo.splice(todoi, 1)
    const i = ss.sets.indexOf(s)
    if (i === -1)
        throw new Error('tried to remove non-existent set')
    ss.sets.splice(i, 1)
}

function ss_overlap(ss, x, y, mask) {
    const ret = []
    for (let xx = x - 3; xx < x + 3; xx++) {
        for (let yy = y - 3; yy < y + 3; yy++) {
            /*
             * Find the first set with these top left coordinates.
             */
            let pos = _setindexof_ge(ss.sets, {x: xx, y: yy, mask: 0})
            if (ss.sets[pos] != null) {
                let s = ss.sets[pos]
                while (s != null && s.x === xx && s.y === yy) {
                    /*
                     * This set potentially overlaps the input one.
                     * Compute the intersection to see if they
                     * really overlap, and add it to the list if so.
                     */
                    if (setmunge({x, y, mask}, s, false)) {
                        /*
                         * There's an overlap.
                         */
                        ret.push(s)
                    }

                    s = ss.sets[++pos]
                }
            }
        }
    }
    return ret
}

/*
 * Take two input sets, in the form (x,y,mask). Munge the first by
 * taking either its intersection with the second or its difference
 * with the second. Return the new mask part of the first set.
 */
function setmunge({x: x1, y: y1, mask: mask1}, {x: x2, y: y2, mask: mask2}, diff = false) {
    /*
     * Adjust the second set so that it has the same x,y
     * coordinates as the first
     */
    if (Math.abs(x2 - x1) >= 3 || Math.abs(y2 - y1) >= 3) {
        mask2 = 0
    } else {
        while (x2 > x1) {
            mask2 &= ~(4 | 32 | 256)
            mask2 <<= 1
            x2--
        }
        while (x2 < x1) {
            mask2 &= ~(1 | 8 | 64)
            mask2 >>= 1
            x2++
        }
        while (y2 > y1) {
            mask2 &= ~(64 | 128 | 256)
            mask2 <<= 3
            y2--
        }
        while (y2 < y1) {
            mask2 &= ~(1 | 2 | 4)
            mask2 >>= 3
            y2++
        }
    }

    /*
     * Invert the second set if diff is set (we're after A &~ B
     * rather than A & B).
     */
    if (diff)
        mask2 ^= 511

    return mask1 & mask2
}

/*
 * Count the bits in a word. Only needs to cope with 16 bits.
 */
function bitcount16(inword) {
    let word = inword

    word = ((word & 0xAAAA) >>> 1) + (word & 0x5555)
    word = ((word & 0xCCCC) >>> 2) + (word & 0x3333)
    word = ((word & 0xF0F0) >>> 4) + (word & 0x0F0F)
    word = ((word & 0xFF00) >>> 8) + (word & 0x00FF)

    return word
}

function _strmask(mask) {
    return ('\n'
        + ((mask & 1) ? '.' : 'X')
        + ((mask & 2) ? '.' : 'X')
        + ((mask & 4) ? '.' : 'X') + '\n'
        + ((mask & 8) ? '.' : 'X')
        + ((mask & 16) ? '.' : 'X')
        + ((mask & 32) ? '.' : 'X') + '\n'
        + ((mask & 64) ? '.' : 'X')
        + ((mask & 128) ? '.' : 'X')
        + ((mask & 256) ? '.' : 'X') + '\n'
    )
}
/* eslint-enable no-param-reassign */

export {Solver}

import Emitter from 'component-emitter'

import {GridStateEnum as gse} from 'common'
import {GameState} from './engine'

/** Game window class, containing controls separated from rules. */
export class GameWindow extends Emitter {
    /**
     * @param root HTMLElement - root element to bind game field
     * @param state GameState - game state object to render
     * @param indicators Array<HTMLElement> - auxiliary indicators
     * @param [active] - Whether to assign event listeners, or just display state
     */
    constructor(root, state, indicators, active = true) {
        super()
        this.init(root, state, indicators, active)

        // TODO make these removeable for cleanup
        root.addEventListener('mousedown', this.onmousedown.bind(this))
        root.addEventListener('mouseup', this.onmouseup.bind(this))
        root.addEventListener('mousemove', this.onmousemove.bind(this))
        root.addEventListener('mouseleave', () => {
            this._x_last = null
            this._y_last = null
            this.redraw_anim()
        })
        root.addEventListener('contextmenu', e => e.preventDefault())
        document.addEventListener('keypress', this.onkeypress.bind(this))
        indicators[1].addEventListener('click', () => this.reset())
    }
    init(root, state, indicators, active = true) {
        this.root = root || this.root
        this.state = state || this.state
        this.active = active
        this._grid = []

        this.state.on('start', this.onstart.bind(this))
        this.state.on('end', this.onend.bind(this))

        while (this.root.firstChild)
            this.root.removeChild(this.root.firstChild)
        for (let h = 0; h < state.h; h++) {
            const row = document.createElement('div')
            row.className = 'row'
            for (let w = 0; w < state.w; w++) {
                const tile = document.createElement('div')
                tile.className = 'tile closed'
                tile.dataset.coord = '' + w + 'x' + h
                this._grid[h * state.w + w] = tile
                row.appendChild(tile)
            }
            this.root.appendChild(row)
        }

        this.indicator_flags = indicators ? indicators[0] : this.indicator_flags
        this.indicator_flags.classList.add('indicator', 'counter')
        this._flags_remain = null
        this.indicator_yellow = indicators ? indicators[1] : this.indicator_yellow
        this.indicator_yellow.classList.add('indicator', 'yellow', 'happy')
        this.indicator_clock = indicators ? indicators[2] : this.indicator_clock
        this.indicator_clock.classList.add('indicator', 'counter')
        this.time_start = null
        this.time_stop = null

        this._chord_last = null
        this._x_last = null
        this._y_last = null
        this._draw_queue = []
        this._anim_queue = []

        this.indicator_flags.textContent = '!!!'
        this.indicator_clock.textContent = '!!!'

        /**
         * Game initialise event.
         *
         * @event GameWindow#init
         * @param {GameState} state - The new game state.
         * */
        this.emit('init', this.state)
    }
    reset() {
        this.init(null, new GameState(this.state.h, this.state.w, this.state.n), null)
    }
    destroy() {
        // FIXME not removable
        /*this.root.removeEventListener('mousedown', this.mousedown)
        this.root.removeEventListener('mouseup', this.mouseup)
        this.root.removeEventListener('mousemove', this.mousemove)*/
        this.root = null
        this.state = null
        this._grid = null
        this.time_start = null // kills the tick loop
    }

    onstart() {
        this.time_start = Date.now()
        this._flags_remain = this.state.n
        requestAnimationFrame(() => this.tick())
    }

    onend(win) {
        this.time_stop = Date.now()
        this.emit('end', win)
        if (win) {
            // full reveal, flag remaining mines
            for (let i = 0; i < this.state.h * this.state.w; i++) {
                if (this.state.mines[i] && this.state.grid[i] === gse.Unknown)
                    this.state.grid[i] = gse.Flag
            }
        } else {
            // full reveal, show remaining mines
            for (let i = 0; i < this.state.h * this.state.w; i++) {
                if (this.state.mines[i]) {
                    if (this.state.grid[i] === gse.Unknown)
                        this.state.grid[i] = gse.MineRevealed
                } else if (this.state.grid[i] === gse.Flag) {
                    this.state.grid[i] = gse.WrongFlag
                }
            }
        }
        requestAnimationFrame(() => {
            this.indicator_yellow.classList.remove('surprise', 'happy')
            this.indicator_yellow.classList.add(win ? 'cool' : 'dead')
            this.redraw_full()
        })
    }
    
    onmousedown(e) {
        if (!this.active)
            return
        if (e.target.className.indexOf('tile') === -1)
            return
        if (this.state.won || this.state.dead)
            return
        const xy = e.target.dataset.coord.split('x')
        const x = parseInt(xy[0], 10), y = parseInt(xy[1], 10)

        if (e.button === 2 && e.buttons === 2 || e.button === 0 && e.ctrlKey) {
            // right button (or left+ctrl), triggers early
            this._flag(x, y)
        } else if (e.button === 0 && e.buttons === 1) {
            // anim click
            requestAnimationFrame(() => {
                if (this.state.grid[y * this.state.w + x] === gse.Unknown) {
                    this._grid[y * this.state.w + x].className = 'tile open'
                    this._anim_queue.push(y * this.state.w + x)
                }
                this.indicator_yellow.classList.replace('happy', 'surprise')
            })
        } else if (e.button === 2 && (e.buttons & 1) || e.button === 0 && (e.buttons & 2)) {
            this._chord_last = null
            requestAnimationFrame(() => {
                const w = this.state.w, h = this.state.h
                for (let dx = -1; dx <= +1; dx++) {
                    for (let dy = -1; dy <= +1; dy++) {
                        if (x + dx >= 0 && x + dx < w
                            && y + dy >= 0 && y + dy < h
                            && this.state.grid[(y + dy) * w + (x + dx)] === gse.Unknown) {
                            this._grid[(y + dy) * w + (x + dx)].className = 'tile open'
                            this._anim_queue.push((y + dy) * w + (x + dx))
                        }
                    }
                }
            })
        }

        e.preventDefault()
    }

    onmouseup(e) {
        if (!this.active)
            return
        if (e.target.className.indexOf('tile') === -1)
            return
        if (this.state.won || this.state.dead)
            return
        const xy = e.target.dataset.coord.split('x')
        const x = parseInt(xy[0], 10), y = parseInt(xy[1], 10)
        const i = y * this.state.w + x

        if (e.button === 0 && (e.buttons & 2) || e.button === 2 && (e.buttons & 1) || e.button === 1) {
            // left+right button or middle button
            this._chord(x, y)
            if (!(this.state.won || this.state.dead)) {
                requestAnimationFrame(() => {
                    this.indicator_yellow.classList.remove('surprise', 'dead', 'cool')
                    this.indicator_yellow.classList.add('happy')
                    this.redraw_anim()
                })
            }
        } else if (e.button === 0 && !e.ctrlKey && !this._chord_last) {
            // left button
            if (this._open(x, y)) {
                requestAnimationFrame(() => {
                    this.indicator_yellow.classList.remove('surprise', 'dead', 'cool')
                    this.indicator_yellow.classList.add('happy')
                    this.redraw_anim()
                })
            }
        }

        // log last click if multiple buttons pressed for chord
        // compatible with 1.5 click strategy, but not in other direction
        if ((e.buttons & 1) && e.button === 2)
            this._chord_last = true
        else
            this._chord_last = null
        e.preventDefault()
    }

    onmousemove(e) {
        if (!this.active)
            return
        if (e.path[0].className.indexOf('tile') === -1)
            return
        if (this.state.won || this.state.dead)
            return
        const xy = e.path[0].dataset.coord.split('x')
        const x = parseInt(xy[0], 10), y = parseInt(xy[1], 10)
        if (this._x_last === x && this._y_last === y)
            return
        this._x_last = x
        this._y_last = y

        if (e.buttons !== 0 && !this._chord_last) {
            // Animate squares on press and hold etc.
            requestAnimationFrame(() => {
                const w = this.state.w, h = this.state.h
                this.redraw_anim()
                if ((e.buttons & 3) === 3) {
                    for (let dx = -1; dx <= +1; dx++) {
                        for (let dy = -1; dy <= +1; dy++) {
                            if (x + dx >= 0 && x + dx < w
                                && y + dy >= 0 && y + dy < h
                                && this.state.grid[(y + dy) * w + (x + dx)] === gse.Unknown) {
                                this._grid[(y + dy) * w + (x + dx)].className = 'tile open'
                                this._anim_queue.push((y + dy) * w + (x + dx))
                            }
                        }
                    }
                } else if (e.buttons & 1) {
                    if (this.state.grid[y * w + x] === gse.Unknown) {
                        this._grid[y * w + x].className = 'tile open'
                        this._anim_queue.push(y * w + x)
                    }
                }
            })
        }
    }

    onkeypress(e) {
        if (!this.active)
            return
        if (this.state.won || this.state.dead)
            return
        if (e.code === 'Space' && this._x_last != null && this._y_last != null && !e.repeat) {
            const i = this._y_last * this.state.w + this._x_last
            if (this.state.grid[i] === gse.Unknown || this.state.grid[i] === gse.Flag)
                this._flag(this._x_last, this._y_last)
            else if (1 <= this.state.grid[i] && this.state.grid[i] <= 8)
                this._chord(this._x_last, this._y_last)
            e.preventDefault()
        }
    }

    redraw_full() {
        //this.tick()
        for (let y = 0; y < this.state.h; y++) {
            for (let x = 0; x < this.state.w; x++)
                this.redraw(y * this.state.w + x)
        }
    }

    redraw_anim() {
        for (let i of this._anim_queue)
            this.redraw(i)
    }

    redraw(i) {
        switch (this.state.grid[i]) {
        case gse.Unknown:
            this._grid[i].className = 'tile closed'
            break
        case gse.Flag:
            this._grid[i].className = 'tile closed flag'
            break
        case gse.MineRevealed:
            this._grid[i].className = 'tile closed mine'
            break
        case gse.MineClicked:
            this._grid[i].className = 'tile open red mine'
            break
        case gse.WrongFlag:
            this._grid[i].className = 'tile closed nomine'
            break
        default:
            this._grid[i].className = 'tile open n' + this.state.grid[i]
            break
        }
    }

    tick() {
        const dt = (this.time_stop || Date.now()) - this.time_start
        // MS sweeper starts clock at 1
        this.indicator_clock.textContent = ('' + (~~(dt / 1000) + 1)).padStart(3, '0')
        if (this.time_stop != null)
            this.indicator_clock.setAttribute('title', `${~~(dt / 60000)}:${(dt / 1000) % 60}`)

        //this.indicator_flags = this.state.grid.reduce((a, v) => a - (v === gse.Flag), this.state.n)
        this.indicator_flags.textContent = ('' + this._flags_remain).padStart(3, '0')

        for (let i of this._draw_queue)
            this.redraw(i)

        if (this.time_stop == null && this.time_start != null)
            requestAnimationFrame(() => this.tick())
    }

    _open(x, y) {
        if (this.state.grid[y * this.state.w + x] === gse.Unknown) {
            const rv = this.state.open(x, y)
            requestAnimationFrame(() => this.redraw_full())
            /**
             * Grid square opened event.
             *
             * @event GameWindow#open
             * @param {number} x - X coordinate of opened square
             * @param {number} y - Y coordinate of opened square
             * @param {boolean} ok - Whether the game continues after this open
             */
            this.emit('open', x, y, rv)
            return rv
        }
        return true
    }

    _flag(x, y) {
        const i = y * this.state.w + x
        if (this.time_start == null)
            return
        if (this.state.grid[i] === gse.Unknown) {
            this.state.grid[i] = gse.Flag
            this._draw_queue.push(i)
            this._flags_remain -= 1
            /**
             * Grid square flag event.
             *
             * @event GameWindow#flag
             * @param {number} x - X coordinate of flagged square
             * @param {number} y - Y coordinate of flagged square
             * @param {number} df - Flag change, 1 for addition and -1 for removal
             * @param {number} remain - Remaining flags
             */
            this.emit('flag', x, y, 1, this._flags_remain)
        } else if (this.state.grid[i] === gse.Flag) {
            this.state.grid[i] = gse.Unknown
            this._draw_queue.push(i)
            this._flags_remain += 1
            this.emit('flag', x, y, -1, this._flags_remain)
        }
    }

    _chord(x, y) {
        const w = this.state.w, h = this.state.h
        const i = y * w + x
        if (this.time_start == null || !(1 <= this.state.grid[i] && this.state.grid[i] <= 8))
            return

        let v = 0
        for (let dx = -1; dx <= +1; dx++) {
            for (let dy = -1; dy <= +1; dy++) {
                if (x + dx >= 0 && x + dx < w
                    && y + dy >= 0 && y + dy < h
                    && this.state.grid[(y + dy) * w + (x + dx)] === gse.Flag)
                    v++
            }
        }

        if (v === this.state.grid[i]) {
            for (let dx = -1; dx <= +1; dx++) {
                for (let dy = -1; dy <= +1; dy++) {
                    if (x + dx >= 0 && x + dx < w
                        && y + dy >= 0 && y + dy < h
                        && this.state.grid[(y + dy) * w + (x + dx)] === gse.Unknown) {
                        const rv = this.state.open(x + dx, y + dy)
                        this.emit('open', x, y, rv)
                    }
                }
            }
        }

        requestAnimationFrame(() => this.redraw_full())
    }
}

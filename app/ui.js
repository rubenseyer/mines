import {GridStateEnum as gse} from 'common'

/** Game window class, containing controls separated from rules. */
export class GameWindow {
    /**
     * @param root HTMLElement - root element to bind game field
     * @param state GameState - game state object to render
     * @param indicators Array<HTMLElement> - auxiliary indicators
     */
    constructor(root, state, indicators) {
        this.init(root, state, indicators)

        // TODO make these removeable for cleanup
        root.addEventListener('mousedown', this.onmousedown.bind(this))
        root.addEventListener('mouseup', this.onmouseup.bind(this))
        root.addEventListener('mousemove', this.onmousemove.bind(this))
        root.addEventListener('mouseleave', () => {
            this._x_last = null
            this._y_last = null
        })
        root.addEventListener('contextmenu', e => e.preventDefault())
        document.addEventListener('keypress', this.onkeypress.bind(this))
    }
    init(root, state, indicators) {
        this.root = root || this.root
        this.state = state || this.state
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
        this._flags_remain = null
        this.indicator_yellow = indicators ? indicators[1] : this.indicator_yellow
        this.indicator_clock = indicators ? indicators[2] : this.indicator_clock
        this.time_start = null
        this.time_stop = null

        this._chord_last = null
        this._x_last = null
        this._y_last = null
        this._draw_queue = []

        requestAnimationFrame(() => {
            this.indicator_flags.textContent = '!!!'
            this.indicator_clock.textContent = '!!!'
        })
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
            // TODO: change yellow man to glasses or dead
            this.redraw_full()
        })
    }
    
    onmousedown(e) {
        if (e.target.className.indexOf('tile') === -1)
            return
        if (this.state.won || this.state.dead)
            return
        const xy = e.target.dataset.coord.split('x')
        const x = parseInt(xy[0], 10), y = parseInt(xy[1], 10)

        if (e.button === 2 || e.button === 0 && e.ctrlKey) {
            // right button (or left+ctrl), triggers early
            this._flag(x, y)
        }
        e.preventDefault()
    }

    onmouseup(e) {
        if (e.target.className.indexOf('tile') === -1)
            return
        if (this.state.won || this.state.dead)
            return
        const xy = e.target.dataset.coord.split('x')
        const x = parseInt(xy[0], 10), y = parseInt(xy[1], 10)
        const i = y * this.state.w + x

        // log last click if multiple buttons pressed for chord
        // compatible with 1.5 click strategy
        if (e.buttons !== 0 && (e.button === 0 || e.button === 2)) {
            this._chord_last = e.button
            return
        }
        const chord = this._chord_last === 0 && e.button === 2 || this._chord_last === 2 && e.button === 0
        this._chord_last = null

        if (chord || e.button === 1) {
            // left+right button or middle button
            this._chord(x, y)
        } else if (e.button === 0 && !e.ctrlKey) {
            // left button
            this._open(x, y)
            // TODO left click?
        }

        e.preventDefault()
    }

    onmousemove(e) {
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
        // TODO Animate squares on press and hold etc.
    }

    onkeypress(e) {
        if (this.state.won || this.state.dead)
            return
        if (e.code === 'Space' && this._x_last != null && this._y_last != null) {
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

        for (const i of this._draw_queue)
            this.redraw(i)

        if (this.time_stop == null && this.time_start != null)
            requestAnimationFrame(() => this.tick())
    }

    _open(x, y) {
        if (this.state.grid[y * this.state.w + x] === gse.Unknown) {
            this.state.open(x, y)
            requestAnimationFrame(() => this.redraw_full())
        }
    }

    _flag(x, y) {
        const i = y * this.state.w + x
        if (this.time_start == null)
            return
        if (this.state.grid[i] === gse.Unknown) {
            this.state.grid[i] = gse.Flag
            this._draw_queue.push(i)
            this._flags_remain -= 1
        } else if (this.state.grid[i] === gse.Flag) {
            this.state.grid[i] = gse.Unknown
            this._draw_queue.push(i)
            this._flags_remain += 1
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
                        && this.state.grid[(y + dy) * w + (x + dx)] === gse.Unknown)
                        this.state.open(x + dx, y + dy)
                }
            }
        }

        requestAnimationFrame(() => this.redraw_full())
    }
}

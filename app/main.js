import dragable from '../lib/dragable'
import {GameState} from 'engine'
import {GameWindow} from 'gameui'

// TODO Make this a real application

const DIFFICULTIES = {
    beg: {h: 9, w: 9, n: 10},
    int: {h: 16, w: 16, n: 40},
    exp: {h: 16, w: 30, n: 99},
    ext: {h: 24, w: 30, n: 199},
}

class Settings {
    constructor(root, cb, initial) {
        this.root = root
        this.cb = cb
        this.v = initial

        document.getElementById('settings').addEventListener('click', this.click.bind(this))
        document.getElementById('settings-container').addEventListener('change', this.change.bind(this))

        this.update(initial)
    }

    click(e) {
        if (e.target.name === 'mode') {
            this.v.mode = e.target.value
        } else if (e.target.name === 'difficulty') {
            this.v.difficulty = e.target.value
            if (e.target.value !== 'cus') {
                Object.assign(this.v, DIFFICULTIES[e.target.value])
                document.getElementById('sinput-h').value = this.v.h
                document.getElementById('sinput-w').value = this.v.w
                document.getElementById('sinput-n').value = this.v.n
            }
        } else {
            switch (e.target.id) {
            case 'sinput-ok':
                this.cb(this.v)
                // fallthrough
            case 'sinput-cancel':
                this.close()
                break
            }
        }
    }

    change(e) {
        if (e.target.type !== 'number')
            return
        this.v.difficulty = 'cus'
        document.getElementById('sradio-cus').checked = true
        switch (e.target.name) {
        case 'h':
            this.v.h = parseInt(e.target.value, 10)
            break
        case 'w':
            this.v.w = parseInt(e.target.value, 10)
            break
        case 'n':
            this.v.n = parseInt(e.target.value, 10)
            break
        }
    }

    open(v) {
        if (v != null)
            this.update(v)
        this.root.style.visibility = 'visible'
    }

    close() {
        this.root.style.visibility = 'collapse'
    }

    update() {
        // TODO maybe make more modularised?
        document.getElementById('sradio-' + this.v.mode).checked = true
        document.getElementById('sradio-' + this.v.difficulty).checked = true
        document.getElementById('sinput-h').value = this.v.h
        document.getElementById('sinput-w').value = this.v.w
        document.getElementById('sinput-n').value = this.v.n
    }
}

/** Top-level class, managing state */
export class Manager {
    constructor() {
        this.wmain = document.getElementById('main-game')
        this.wroom = document.getElementById('w-room')
        //this.wlist = document.getElementById('w-list')
        //this.wtop = document.getElementById('w-top')

        this.room_state = {
            // TODO make this multiplayer stuff work etc
            admin: true,
        }

        this.settings = {
            mode: 'solo',
            difficulty: 'exp',
            h: 16,
            w: 30,
            n: 99,
        }
        this.wsettings = new Settings(
            document.getElementById('settings'),
            this.settings_set.bind(this),
            this.settings
        )
        this.bsettings = document.getElementById('settings-button')
        this.bsettings.addEventListener('click', () => {
            if (this.room_state.admin)
                this.wsettings.open(this.settings)
        })
        this.label_set()

        this.main = new GameWindow(
            this.wmain.querySelector('.minefield'),
            new GameState(this.settings.h, this.settings.w, this.settings.n),
            this.wmain.getElementsByClassName('indicator')
        )

        for (let w of document.querySelectorAll('main > .window'))
            dragable(w.querySelector('.titlebar'), w)

        const mfw = this.wmain.querySelector('.minefield-wrapper')
        const mf = this.wmain.querySelector('.minefield')
        /* global addResizeListener */
        addResizeListener(mfw, function main_resize(e) {
            const scale = Math.max(Math.min(mfw.offsetWidth / mf.scrollWidth, mfw.offsetHeight / mf.scrollHeight), 1)
            mf.style.transform = 'translate(-50%, -50%) scale(' + scale + ')'
        })
        const scale = Math.min(mfw.offsetWidth / mf.scrollWidth, mfw.offsetHeight / mf.scrollHeight)
        mf.style.transform = 'translate(-50%, -50%) scale(' + scale + ')'
    }

    label_set() {
        // TODO: Show lobby owner name later
        let l = `${this.settings.h}x${this.settings.w}, ${this.settings.n}`
        switch (this.settings.mode) {
        case 'solo':
            switch (this.settings.difficulty) {
            case 'beg':
                l = 'Beginner (' + l + ')'
                break
            case 'int':
                l = 'Intermediate (' + l + ')'
                break
            case 'exp':
                l = 'Expert (' + l + ')'
                break
            case 'ext':
                l = 'Extreme (' + l + ')'
                break
            }
            break
        }
        requestAnimationFrame(() => {
            document.getElementById('room-label').textContent = l
        })
    }

    settings_set(v, nonuser = false) {
        // TODO maybe something more advanced should happen later
        if (nonuser || this.room_state.admin) {
            Object.assign(this.settings, v)
            this.main.init(
                null,
                new GameState(this.settings.h, this.settings.w, this.settings.n),
                null,
                this.main.active
            )
        }
        this.label_set()
    }
}

window.manager = new Manager()

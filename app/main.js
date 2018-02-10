import dragable from '../lib/dragable'
import {GameState} from 'engine'
import {GameWindow} from 'gameui'
import {Server, P2PManager} from 'online'
import {MinesweeperDifficulty, MinesweeperMode} from './common'

// TODO Make this a real application

const DIFFICULTIES = {
    [MinesweeperDifficulty.Beginner]: {h: 9, w: 9, n: 10},
    [MinesweeperDifficulty.Intermediate]: {h: 16, w: 16, n: 40},
    [MinesweeperDifficulty.Expert]: {h: 16, w: 30, n: 99},
    [MinesweeperDifficulty.Extreme]: {h: 24, w: 30, n: 199},
}

class Settings {
    constructor(root, cb, initial) {
        this.root = root
        this.cb = cb
        this.v = Object.assign({}, initial)

        document.getElementById('settings').addEventListener('click', this.click.bind(this))
        document.getElementById('settings-container').addEventListener('change', this.change.bind(this))

        this.update(initial)
    }

    click(e) {
        if (e.target.name === 'Mode') {
            this.v.Mode = e.target.value
        } else if (e.target.name === 'Difficulty') {
            this.v.Difficulty = e.target.value
            if (e.target.value !== 'cus') {
                Object.assign(this.v, DIFFICULTIES[e.target.value])
                document.getElementById('sinput-h').value = this.v.H
                document.getElementById('sinput-w').value = this.v.W
                document.getElementById('sinput-n').value = this.v.N
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
        this.v.Difficulty = 'cus'
        document.getElementById('sradio-cus').checked = true
        switch (e.target.name) {
        case 'h':
            this.v.H = parseInt(e.target.value, 10)
            break
        case 'w':
            this.v.W = parseInt(e.target.value, 10)
            break
        case 'n':
            this.v.N = parseInt(e.target.value, 10)
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
        document.getElementById('sradio-' + this.v.Mode).checked = true
        document.getElementById('sradio-' + this.v.Difficulty).checked = true
        document.getElementById('sinput-h').value = this.v.H
        document.getElementById('sinput-w').value = this.v.W
        document.getElementById('sinput-n').value = this.v.N
    }
}

/** Top-level class, managing state */
export class Manager {
    constructor() {
        this.wmain = document.getElementById('main-game')
        this.wroom = document.getElementById('w-room')
        this.wlist = document.getElementById('w-list')
        //this.wtop = document.getElementById('w-top')

        this.room_state = {
            // TODO make this multiplayer stuff work etc
            admin: true,
        }

        /** @type {RoomSettings} */
        this.settings = {
            Mode: MinesweeperMode.Solo,
            Difficulty: MinesweeperDifficulty.Expert,
            H: 16,
            W: 30,
            N: 99,
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
            new GameState(this.settings.H, this.settings.W, this.settings.N),
            this.wmain.getElementsByClassName('indicator')
        )
        this.main.on('end', this.onend.bind(this))

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

        if (window.RTCPeerConnection != null) {
            this.server = new Server()
            this.server.on('connected', this.onconnected.bind(this)).
                on('error', this.alert.bind(this)).
                on('users', this.online_set.bind(this)).
                on('records', this.records_set.bind(this))
            const username = localStorage.getItem('username')
            if (username != null) {
                this.server.connect(username, this.settings)
            } else {
                document.getElementById('signin').style.display = 'block'
                document.querySelector('#signin .button').addEventListener('click', () => {
                    const uu = document.querySelector('#signin input').value
                    this.server.connect(uu, this.settings)
                })
            }
        }
    }

    onconnected(data) {
        localStorage.setItem('username', data.username)
        this.wlist.querySelector('.listui').addEventListener('click', () => {
            // TODO join room
        })
        // TODO update other data?
        requestAnimationFrame(() => {
            document.getElementById('signin').style.display = 'none'
            for (let el of document.querySelectorAll('.online-only'))
                el.classList.remove('online-only')
        })
    }

    onend(win) {
        // TODO maybe send a message out
        if (!win)
            return
        const r = {
            Username: this.server.me,
            Mode: this.settings.Mode,
            Difficulty: this.settings.Difficulty,
            Time: this.main.time_stop - this.main.time_start,
        }
        // TODO local records
        this.server.send({Record: r})
    }

    label_set() {
        // TODO: Show lobby owner name later
        const l = labelf(this.settings)
        requestAnimationFrame(() => {
            document.getElementById('room-label').textContent = l
            //document.getElementById('room-owner').textContent = ....
        })
    }

    online_set() {
        // TODO partial updates (param)
        const nodes = []
        for (let u of Object.values(this.server.users)) {
            const p = document.createElement('div')
            p.classList.add('user-entry')
            const n1 = document.createElement('div')
            n1.textContent = u.Username
            p.appendChild(n1)
            const n2 = document.createElement('div')
            n2.textContent = labelf(u.CurrentRoom)
            p.appendChild(n2)
            nodes.push(p)
        }
        requestAnimationFrame(() => {
            this.wlist.querySelector('.titlebar').textContent = `Online (${Object.keys(this.server.users).length + 1})`
            const list = this.wlist.querySelector('.listui')
            while (list.firstChild)
                list.removeChild(list.firstChild)
            for (let n of nodes)
                list.appendChild(n)
            //document.getElementById('room-owner').textContent = .... in case of room owner dc?
        })
    }

    records_set() {
        // TODO partial updates (param)
        const alltime = document.getElementById('top-alltime')
        //
        while (alltime.firstChild)
            alltime.removeChild(alltime.firstChild)
        function row(r, long) {
            if (r == null)
                return
            const tr = document.createElement('tr')
            tr.innerHTML = `<td><em>${long}</em></td><td>${r.Username}</td><td>${r.Time}</td>`
            alltime.appendChild(tr)
        }
        row(this.server.records.Best[MinesweeperDifficulty.Beginner], 'Beginner')
        row(this.server.records.Best[MinesweeperDifficulty.Intermediate], 'Intermediate')
        row(this.server.records.Best[MinesweeperDifficulty.Expert], 'Expert')
        row(this.server.records.Best[MinesweeperDifficulty.Extreme], 'Extreme')
        // TODO const local = document.getElementById('top-local')
        const recent = document.getElementById('recentrecordslist')
        while (recent.firstChild)
            recent.removeChild(recent.firstChild)
        for (let r of this.server.records.Latest) {
            const d = document.createElement('div')
            d.innerHTML = `<span>${r.Username}</span><span>${labelf(r)}</span><span>${r.Time}</span>`
            recent.appendChild(d)
        }
    }

    settings_set(v, nonuser = false) {
        // TODO maybe something more advanced should happen later
        if (nonuser || this.room_state.admin) {
            Object.assign(this.settings, v)
            this.main.init(
                null,
                new GameState(this.settings.H, this.settings.W, this.settings.N),
                null,
                this.main.active
            )
        }
        this.label_set()
    }

    alert(msg) {
        const main = document.querySelector('main')
        const awindow = document.createElement('div')
        awindow.classList.add('alert', 'window')
        const title = document.createElement('div')
        title.classList.add('titlebar')
        title.textContent = 'Alert'
        awindow.appendChild(title)
        const content = document.createElement('div')
        content.textContent = msg
        awindow.appendChild(content)
        const toolbar = document.createElement('div')
        toolbar.classList.add('toolbar-bottom')
        const okbutton = document.createElement('a')
        okbutton.classList.add('button', 'alert-ok')
        okbutton.textContent = '\xa0\xa0OK\xa0\xa0'
        okbutton.addEventListener('click', () => {
            main.removeChild(awindow)
        })
        toolbar.appendChild(okbutton)
        awindow.appendChild(toolbar)
        requestAnimationFrame(() => main.appendChild(awindow))
    }
}

window.manager = new Manager()

function labelf(settings) {
    let l = `${settings.H}x${settings.W}, ${settings.N}`
    switch (settings.Mode) {
    case MinesweeperMode.Solo:
        switch (settings.Difficulty) {
        case MinesweeperDifficulty.Beginner:
            l = 'Beginner (' + l + ')'
            break
        case MinesweeperDifficulty.Intermediate:
            l = 'Intermediate (' + l + ')'
            break
        case MinesweeperDifficulty.Expert:
            l = 'Expert (' + l + ')'
            break
        case MinesweeperDifficulty.Extreme:
            l = 'Extreme (' + l + ')'
            break
        }
        break
    }
    return l
}

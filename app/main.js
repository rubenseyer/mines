import dragable from '../lib/dragable'
import {GameState} from 'engine'
import {GameWindow} from 'gameui'
import {Server, P2PManager} from 'online'
import {MinesweeperDifficulty as MSDifficulty, MinesweeperMode as MSMode} from './common'

// TODO Make this a real application

const DIFFICULTIES = {
    [MSDifficulty.Beginner]:     {H: 9,  W: 9,  N: 10}, // eslint-disable-line no-multi-spaces
    [MSDifficulty.Intermediate]: {H: 16, W: 16, N: 40},
    [MSDifficulty.Expert]:       {H: 16, W: 30, N: 99},
    [MSDifficulty.Extreme]:      {H: 24, W: 30, N: 199},
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
        if (e.target.name === 'mode') {
            this.v.Mode = e.target.value
        } else if (e.target.name === 'difficulty') {
            this.v.Difficulty = e.target.value
            if (e.target.value !== MSDifficulty.Custom) {
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
        this.v.Difficulty = MSDifficulty.Custom
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

        /** @type {RoomSettings} */
        this.settings = {
            Mode: MSMode.Solo,
            Difficulty: MSDifficulty.Expert,
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
            if (this.server.host)
                this.wsettings.open(this.settings)
        })
        this.label_set()

        this.main = new GameWindow(
            this.wmain.querySelector('.minefield'),
            new GameState(this.settings.H, this.settings.W, this.settings.N, Date.now()),
            this.wmain.getElementsByClassName('indicator')
        )
        this.main.
            on('init', this.oninit.bind(this)).
            on('end', this.onend.bind(this)).
            on('open', this.ongameevent.bind(this, 'open')).
            on('flag', this.ongameevent.bind(this, 'flag'))

        for (const w of document.querySelectorAll('main > .window'))
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
            this.p2p = new P2PManager()
            this.p2p.on('signal', msg => this.server.send({RoomP2P: msg})).
                on('join', this.onp2pjoin.bind(this)). // TODO these functions should affect the room list
                on('message', this.onp2pmessage.bind(this)).
                on('leave', this.onp2pleave.bind(this))
            this.server.on('signal', this.p2p.onsignal.bind(this.p2p))
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
        localStorage.setItem('username', data.Username)

        this.wlist.querySelector('.listui').addEventListener('click', e => {
            const roomid = e.path.find(el => el.dataset.roomid != null).dataset.roomid
            if (!roomid)
                return
            for (const u of Object.values(this.server.users)) {
                if (u.CurrentRoom.Id !== roomid)
                    continue
                this.p2p.join(u.Username, roomid)
            }
        })

        this.label_set()

        // TODO update other data?
        requestAnimationFrame(() => {
            document.getElementById('signin').style.display = 'none'
            for (const el of document.querySelectorAll('.online-only'))
                el.classList.remove('online-only')
        })
    }

    onp2pjoin(room, peer, move) {
        if (this.server.host)
            this.p2p.send(peer, this.mkp2psync())

        // ui stuff
        const list = this.wroom.querySelector('.listui')
        if (move) {
            while (list.firstChild)
                list.removeChild(list.firstChild)
        }
        const p = document.createElement('div')
        p.classList.add('list-entry')
        p.textContent = peer
        p.dataset.peerid = peer
        list.appendChild(p)
    }

    onp2pleave(room, peer) {
        // ui stuff
        const list = this.wroom.querySelector('.listui')
        const node = list.querySelector(`.list-entry[data-peerid="${peer}"]`)
        if (node)
            list.removeChild(node)
    }

    onp2pmessage(room, peer, msg) {
        console.log('message', room, peer, msg)
        const m = JSON.parse(msg)
        switch (m.TYPE) {
        case 'init':
            // TODO this needs work for real multiplayer, not just spectate
            if (this.server.host && this.settings.Mode !== MSMode.Solo) {
                const last = this.main.state
                this.main.init(null, new GameState(last.h, last.w, last.n, Date.now()), null, true)
            }
            break
        case 'open':
            if (this.server.host && this.settings.Mode !== MSMode.Solo)
                return
            this.main.state.open(m.x, m.y)
            requestAnimationFrame(() => this.main.redraw_full())
            // TODO this needs work for real multiplayer, not just spectate
            break
        case 'flag':
            if (this.server.host && this.settings.Mode !== MSMode.Solo)
                return
            this.main._flag(m.x, m.y, true)
            // TODO this needs work for real multiplayer, not just spectate
            break
        case 'sync':
            if (peer !== this.server.room.Owner)
                return
            this.settings = m.RoomSettings
            // TODO allow active = real multiplayer
            this.main.init(null, GameState.fromJSON(m.GameState), null, this.server.host)
            this.main._flags_remain = m.UiState.FlagsRemaining
            this.main.time_start = m.UiState.TimeStart
            this.main.time_stop = m.UiState.TimeStop
            if (m.UiState.TimeStart != null)
                requestAnimationFrame(() => this.main.tick())
            this.label_set()
            break
        }
    }

    mkp2psync() {
        return {
            TYPE: 'sync',
            RoomSettings: this.settings,
            GameState: this.main.state,
            UiState: {
                FlagsRemaining: this.main._flags_remain,
                TimeStart: this.main.time_start,
                TimeStop: this.main.time_stop,
            },
        }
    }

    ongameevent(type, x, y, ...args) {
        // TODO maybe a bit more advanced later
        console.log(type, x, y, ...args)
        this.p2p.sendall(this.server.room.Id, {TYPE: type, x, y})
    }

    oninit(state) {
        if (this.server.host)
            this.p2p.sendall(this.server.room.Id, this.mkp2psync())
        else
            this.p2p.sendall(this.server.room.Id, {TYPE: 'init'})
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
        if (r.Difficulty !== MSDifficulty.Custom) {
            const lr = JSON.parse(localStorage.getItem('record-' + r.Difficulty))
            if (lr == null || r.Time < lr.Time)
                localStorage.setItem('record-' + r.Difficulty, JSON.stringify(r))
        }
        this.server.send({Record: r})
    }

    label_set() {
        const l = labelf(this.settings)
        requestAnimationFrame(() => {
            document.getElementById('room-label').textContent = l
            document.getElementById('room-owner').textContent
                = (this.server.room != null) ? this.server.room.Owner : ''
        })
    }

    online_set() {
        // TODO partial updates (param)
        const nodes = []
        for (const u of Object.values(this.server.users)) {
            const p = document.createElement('div')
            p.classList.add('list-entry', 'clickable')
            const n1 = document.createElement('div')
            n1.textContent = u.Username
            p.appendChild(n1)
            const n2 = document.createElement('div')
            n2.textContent = labelf(u.CurrentRoom)
            if (u.CurrentRoom.Owner !== u.Username)
                n2.textContent += ` [${u.CurrentRoom.Owner}]`
            p.appendChild(n2)
            p.dataset.roomid = u.CurrentRoom.Id
            nodes.push(p)
        }
        requestAnimationFrame(() => {
            this.wlist.querySelector('.titlebar').textContent = `Online (${Object.keys(this.server.users).length + 1})`
            const list = this.wlist.querySelector('.listui')
            while (list.firstChild)
                list.removeChild(list.firstChild)
            for (const n of nodes)
                list.appendChild(n)
            this.label_set()
        })
    }

    /* eslint-disable max-len */
    records_set() {
        // TODO partial updates (param)
        function row(t, r, long) {
            if (r == null)
                return
            const tr = document.createElement('tr')
            tr.innerHTML = `<td><em>${long}</em></td><td>${r.Username}</td><td>${r.Time / 1000}</td>`
            t.appendChild(tr)
        }
        const alltime = document.getElementById('top-alltime')
        //
        while (alltime.firstChild)
            alltime.removeChild(alltime.firstChild)
        row(alltime, this.server.records.Best[MSDifficulty.Beginner], MSDifficulty.str(MSDifficulty.Beginner))
        row(alltime, this.server.records.Best[MSDifficulty.Intermediate], MSDifficulty.str(MSDifficulty.Intermediate))
        row(alltime, this.server.records.Best[MSDifficulty.Expert], MSDifficulty.str(MSDifficulty.Expert))
        row(alltime, this.server.records.Best[MSDifficulty.Extreme], MSDifficulty.str(MSDifficulty.Extreme))
        const local = document.getElementById('top-local')
        while (local.firstChild)
            local.removeChild(local.firstChild)
        row(local, JSON.parse(localStorage.getItem('record-' + MSDifficulty.Beginner)), MSDifficulty.str(MSDifficulty.Beginner))
        row(local, JSON.parse(localStorage.getItem('record-' + MSDifficulty.Intermediate)), MSDifficulty.str(MSDifficulty.Intermediate))
        row(local, JSON.parse(localStorage.getItem('record-' + MSDifficulty.Expert)), MSDifficulty.str(MSDifficulty.Expert))
        row(local, JSON.parse(localStorage.getItem('record-' + MSDifficulty.Extreme)), MSDifficulty.str(MSDifficulty.Extreme))
        const recent = document.getElementById('recentrecordslist')
        while (recent.firstChild)
            recent.removeChild(recent.firstChild)
        for (const r of this.server.records.Latest) {
            const d = document.createElement('div')
            d.classList.add('list-entry')
            d.innerHTML = `<span>${r.Username}</span>&nbsp;<span>${MSMode.str(r.Mode)}, ${MSDifficulty.str(r.Difficulty)}</span>&nbsp;<span>${~~(r.Time / 1000) + 1}</span>` // eslint-disable-line max-len
            recent.appendChild(d)
        }
    }
    /* eslint-enable max-len */

    settings_set(v, override = false) {
        // TODO maybe something more advanced should happen later
        if (override || this.server.host) {
            Object.assign(this.settings, v)
            this.main.init(
                null,
                new GameState(this.settings.H, this.settings.W, this.settings.N),
                null,
                this.main.active
            )
            this.server.send({RoomUpdate: {Settings: this.settings}})
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

function sizef(settings) {
    return `${settings.H}x${settings.W}, ${settings.N}`
}

function labelf(settings) {
    let l = sizef(settings)
    switch (settings.Mode) {
    case MSMode.Solo:
        if (settings.Difficulty !== MSDifficulty.Custom)
            l = `${MSDifficulty.str(settings.Difficulty)} (${l})`
        break
    }
    return l
}

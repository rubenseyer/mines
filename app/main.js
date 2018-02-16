import dragable from '../lib/dragable'
import {GameState} from 'engine'
import {P2PManager, Server} from 'online'

import {GameWindow} from 'wgame'
import RecordsToolWindow from 'wrecords'
import SettingsWindow from 'wsettings'

import {colorstr, labelf, MinesweeperDifficulty as MSDifficulty, MinesweeperMode as MSMode} from './common'
import ChatToolWindow from './wchat'

/** Top-level class, managing state */
export class Manager {
    constructor() {
        this.wmain = document.getElementById('main-game')
        this.mfield = this.wmain.querySelector('.minefield')
        this.wroom = document.getElementById('w-room')
        this.bsettings = document.getElementById('settings-button')
        this.bleave = document.getElementById('leave-button')

        /** @type {RoomSettings} */
        this.settings = {
            Mode: MSMode.Solo,
            Difficulty: MSDifficulty.Expert,
            H: 16,
            W: 30,
            N: 99,
        }
        this.wsettings = new SettingsWindow(
            document.getElementById('settings'),
            this.settings_set.bind(this),
            this.settings
        )
        this.bsettings.addEventListener('click', () => {
            if (this.server.host)
                this.wsettings.open(this.settings)
        })
        this.bleave.addEventListener('click', () => {
            this.oncommand('part')
        })
        this.label_set()

        this.wrecords = new RecordsToolWindow(
            document.getElementById('top-alltime'),
            document.getElementById('top-local'),
            document.getElementById('recentrecordslist')
        )

        this.wchat = new ChatToolWindow(
            document.querySelector('#w-list .titlebar'),
            document.getElementById('userlist'),
            document.getElementById('log'),
            document.getElementById('chatinput')
        )

        this.main = new GameWindow(
            this.mfield,
            new GameState(this.settings.H, this.settings.W, this.settings.N, Date.now()),
            this.wmain.getElementsByClassName('indicator')
        )
        this.main.
            on('init', this.oninit.bind(this)).
            on('end', this.onend.bind(this)).
            on('open', this.ongameevent.bind(this, 'open')).
            on('flag', this.ongameevent.bind(this, 'flag')).
            on('mouse', this.ongamemouse.bind(this))

        for (const w of document.querySelectorAll('main > .window'))
            dragable(w.querySelector('.titlebar'), w)

        const mfw = this.mfield.parentElement
        const mf = this.mfield
        /* global addResizeListener */
        addResizeListener(mfw, () => {
            const scale = Math.max(Math.min(mfw.offsetWidth / mf.scrollWidth, mfw.offsetHeight / mf.scrollHeight), 1)
            mf.style.transform = 'translate(-50%, -50%) scale(' + scale + ')'
        })
        const scale = Math.min(mfw.offsetWidth / mf.scrollWidth, mfw.offsetHeight / mf.scrollHeight)
        mf.style.transform = 'translate(-50%, -50%) scale(' + scale + ')'

        if (window.RTCPeerConnection != null) {
            this.server = new Server()
            this.server.on('connected', this.onconnected.bind(this)).
                on('error', alert).
                on('users', this.online_set.bind(this)).
                on('records', () => this.wrecords.update(this.server.records)).
                on('chat', this.wchat.message.bind(this.wchat)).
                on('broadcast', this.wchat.slog.bind(this.wchat))
            this.p2p = new P2PManager()
            this.p2p.on('signal', msg => this.server.send({RoomP2P: msg})).
                on('join', this.onp2pjoin.bind(this)).
                on('message', this.onp2pmessage.bind(this)).
                on('leave', this.onp2pleave.bind(this))
            this.server.on('signal', this.p2p.onsignal.bind(this.p2p))
            this.wchat.
                on('chat', msg => this.server.send({Chat: msg})).
                on('command', this.oncommand.bind(this)).
                on('roomclick', this.onp2pjoinroom.bind(this))
            this.p2pmouseel = []
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
        this.label_set()
        // TODO update other data?
        requestAnimationFrame(() => {
            document.getElementById('signin').style.display = 'none'
            for (const el of document.querySelectorAll('.online-only'))
                el.classList.remove('online-only')
        })
    }
    onp2pjoinroom(room) {
        if (this.server.room.Id === room) {
            this.wchat.slog('Already in room.')
            return true
        }
        let found = false
        for (const u of Object.values(this.server.users)) {
            if (u.CurrentRoom.Id !== room)
                continue
            this.p2p.join(u.Username, room)
            found = true
        }
        return found
    }

    onp2pjoin(room, peer, move) {
        if (this.server.host)
            this.p2p.send(peer, this.mkp2psync())

        if (!move)
            this.wchat.rlog(`${peer} joined room.`)
        else
            this.wchat.rlog(`Joined room ${room}.`)

        // ui stuff
        const list = this.wroom.querySelector('.listui')
        this.bleave.style.display = 'inline-block'
        if (move) {
            while (list.firstChild)
                list.removeChild(list.firstChild)
            this.bsettings.style.display = 'none'
        }
        const color = colorstr(peer)
        const p = document.createElement('div')
        p.classList.add('list-entry')
        p.textContent = peer
        p.dataset.peerid = peer
        p.style.color = color
        list.appendChild(p)

        const c = document.createElement('div')
        c.classList.add('cursor')
        c.style.display = 'none'
        c.style.color = color
        c.style.zIndex = '2'
        c.title = peer
        c.innerHTML = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" xml:space="preserve"><path fill="inherit" d="M24.252,0.143l71.828,67.04l-34.716,2.994l19.753,43.695l-13.168,5.984L48.794,75.563L24.252,98.908V0.143"/></svg>'
        this.p2pmouseel[peer] = c
        document.body.appendChild(c)
    }

    onp2pleave(room, peer) {
        this.wchat.rlog(`${peer} left room.`)
        // ui stuff
        const list = this.wroom.querySelector('.listui')
        const node = list.querySelector(`.list-entry[data-peerid="${peer}"]`)
        if (node)
            list.removeChild(node)
        document.body.removeChild(this.p2pmouseel[peer])
        delete this.p2pmouseel[peer]
    }

    onp2pmessage(room, peer, msg) {
        console.log('message', room, peer, msg)
        const m = JSON.parse(msg)
        switch (m.TYPE) {
        case 'mouse':
            if (m.x === -1 && m.y === -1) {
                this.p2pmouseel[peer].style.display = 'none'
                break
            }
            this.p2pmouseel[peer].style.display = 'block'
            const box = this.mfield.getBoundingClientRect()
            this.p2pmouseel[peer].style.left
                = m.x * box.width - this.mfield.scrollLeft + box.left + 'px'
            this.p2pmouseel[peer].style.top
                = m.y * box.height - this.mfield.scrollTop + box.top + 'px'
            break
        case 'init':
            // TODO this needs work for real multiplayer, not just spectate
            if (this.server.host && this.settings.Mode !== MSMode.Solo) {
                const last = this.settings
                // TODO race needs to open a square first
                this.main.init(null, new GameState(last.H, last.W, last.N, Date.now()), null, true)
            }
            this.wchat.rlog(`${peer} reset the game.`)
            break
        case 'open':
            if (this.server.host && this.settings.Mode === MSMode.Solo || this.settings.Mode === MSMode.Race)
                return
            this.main.state.open(m.x, m.y)
            if (this.main.state.dead)
                this.wchat.rlog(`BANG! ${peer} hit a mine.`)
            requestAnimationFrame(() => this.main.redraw_full())
            // TODO this needs work for modes with multiple fields
            break
        case 'flag':
            if (this.server.host && this.settings.Mode === MSMode.Solo || this.settings.Mode === MSMode.Race)
                return
            this.main._flag(m.x, m.y, true)
            // TODO this needs work for modes with multiple fields
            break
        case 'sync':
            if (peer !== this.server.room.Owner)
                return
            this.settings = m.RoomSettings
            // TODO active check needs to handle multiple fields
            this.main.init(null, GameState.fromJSON(m.GameState), null,
                this.settings.Mode === MSMode.Solo ? this.server.host : true, false)
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
        // TODO maybe a bit more advanced later, e.g. block if race
        console.log(type, x, y, ...args)
        this.p2p.sendall(this.server.room.Id, {TYPE: type, x, y})
    }
    ongamemouse(state, x, y) {
        if ((!this.server.host && this.server.room.Mode === MSMode.Solo) || this.server.room.Mode === MSMode.Race)
            return
        switch (state) {
        case 'move':
            const box = this.mfield.getBoundingClientRect()
            const nx = (x - box.left + this.mfield.scrollLeft) / box.width
            const ny = (y - box.top + this.mfield.scrollTop) / box.height
            this.p2p.sendall(this.server.room.Id, {TYPE: 'mouse', x: nx, y: ny})
            break
        case 'leave':
            this.p2p.sendall(this.server.room.Id, {TYPE: 'mouse', x: -1, y: -1})
            break
        }
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
        if (r.Mode === MSMode.Solo && r.Difficulty !== MSDifficulty.Custom) {
            const lr = JSON.parse(localStorage.getItem('record-' + r.Difficulty))
            if (lr == null || r.Time < lr.Time) {
                localStorage.setItem('record-' + r.Difficulty, JSON.stringify(r))
                alert(`A new personal record!\nTime taken: ${r.Time / 1000} s`)
                this.wchat.rlog(`A new personal record! Time taken: ${r.Time / 1000} s`)
            }
        } else if (r.Mode === MSMode.Race) {
            // TODO: send end over p2p to kill others if they've not won
        }
        alert(`You win!\nTime taken: ${r.Time / 1000} s`)
        this.wchat.rlog(`You win!\nTime taken: ${r.Time / 1000} s`)
        if (this.server.host)
            this.server.send({Record: r})
    }

    oncommand(cmd, params) {
        switch (cmd) {
        case 'connect':
            this.server.connect(!params ? this.server.me : params, this.settings)
            break
        case 'disconnect':
            this.server.socket.close()
            break
        case 'join':
            if (!this.onp2pjoinroom(params))
                this.wchat.slog('Could not find room.')
            break
        case 'part':
            this.p2p.closeall(this.server.room.Id)
            this.server.send({RoomP2P: {Username: null}})
            this.bleave.style.display = 'none'
            this.wchat.rlog('Disconnecting from other users...')
            break
        default:
            this.wchat.slog('Unknown command. Try /HELP.')
        }
    }

    label_set() {
        const l = labelf(this.settings)
        requestAnimationFrame(() => {
            document.getElementById('room-label').textContent = l
            document.getElementById('room-owner').textContent
                = (this.server.room != null) ? this.server.room.Owner : ''
        })
    }

    online_set(data, became_host) {
        if (became_host) {
            // TODO maybe log this
            alert('The previous host disconnected.\nYou are now the host.')
            this.wchat.rlog('The previous host disconnected. You are now the host.')
        }
        if (this.server.host) {
            this.main.active = true
            this.bsettings.style.display = 'inline-block'
        }
        this.wchat.presences(this.server.users)
        requestAnimationFrame(() => this.label_set())
    }

    settings_set(v, override = false) {
        // TODO maybe something more advanced should happen later
        if (override || this.server.host) {
            Object.assign(this.settings, v)
            this.main.init(
                null,
                new GameState(this.settings.H, this.settings.W, this.settings.N, Date.now()),
                null,
                this.main.active
            )
            this.server.send({RoomUpdate: {Settings: this.settings}})
        }
        this.label_set()
    }
}

window.manager = new Manager()

function alert(msg) {
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

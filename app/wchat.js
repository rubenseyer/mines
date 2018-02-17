import Emitter from 'component-emitter'
import {colorstr, labelf} from 'common'

export default class ChatToolWindow extends Emitter {
    constructor(title, list, log, chat) {
        super()
        this.el_title = title
        this.el_list = list
        this.el_log = log
        this.el_chat = chat

        // TODO listen for enter, emit 'chat' or 'command'
        this.el_list.addEventListener('click', e => {
            const roomid = e.path.find(el => el.dataset != null && el.dataset.roomid != null)
            if (!roomid)
                return
            this.emit('roomclick', roomid.dataset.roomid)
        })

        this.el_chat.addEventListener('keyup', e => {
            if (e.code === 'Enter' && this.el_chat.value !== '') {
                if (this.el_chat.value.startsWith('/'))
                    this.oncommand(this.el_chat.value)
                else
                    this.emit('chat', this.el_chat.value)
                this.el_chat.value = ''
            }
        })
    }

    oncommand(str) {
        const line = str.split(' ')
        const cmd = line.shift().slice(1).toLowerCase()
        const params = line.join(' ')
        switch (cmd) {
        case 'help':
            this.slog('Available commands: /CLEAR /CONNECT /DISCONNECT /HELP /JOIN /PART /SETCURSOR')
            break
        case 'clear':
            while (this.el_log.firstChild)
                this.el_log.removeChild(this.el_log.firstChild)
            break
        default:
            this.emit('command', cmd, params)
        }
    }

    message(user, msg) {
        const un = user.Username
        const node = document.createElement('div')
        node.textContent = msg
        node.innerHTML = `&lt;<span style="color:${colorstr(un)}">${un}</span>&gt;&nbsp;` + node.innerHTML
        this.el_log.appendChild(node)
        this.el_log.scrollTop = this.el_log.scrollHeight
    }

    slog(msg) {
        const node = document.createElement('div')
        node.style.color = '#333'
        node.style.fontStyle = 'italic'
        node.textContent = msg
        this.el_log.appendChild(node)
        this.el_log.scrollTop = this.el_log.scrollHeight
    }

    rlog(msg) {
        const node = document.createElement('div')
        node.style.color = '#333'
        node.style.fontWeight = '600'
        node.textContent = msg
        this.el_log.appendChild(node)
        this.el_log.scrollTop = this.el_log.scrollHeight
    }

    presences(users) {
        // TODO partial updates (param)
        const nodes = []
        for (const u of Object.values(users)) {
            const p = document.createElement('div')
            p.classList.add('list-entry', 'clickable')
            const n1 = document.createElement('div')
            n1.textContent = u.Username
            n1.style.color = colorstr(u.Username)
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
            this.el_title.textContent = `Server (${Object.keys(users).length + 1} online)`
            this.presences_clear()
            for (const n of nodes)
                this.el_list.appendChild(n)
        })
    }

    presences_clear() {
        while (this.el_list.firstChild)
            this.el_list.removeChild(this.el_list.firstChild)
    }
}

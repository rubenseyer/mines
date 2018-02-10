import Emitter from 'component-emitter'

export class P2PManager {

}

export class Server extends Emitter {
    constructor() {
        super()

        this.socket = null

        this.me = null
        this.users = {}
        this.records = {Best: {}, Latest: []}
    }

    connect(username, settings) {
        this.socket = new WebSocket('ws://192.168.1.210:8080') // wss://mines.rsid.gq/server
        this.socket.addEventListener('close', e => {
            localStorage.removeItem('username')
            console.error(e)
            this.emit('error', 'Connection failed.')
        })
        this.socket.addEventListener('open', e => {
            // TODO maybe other data?
            // TODO centralise message format somewhere -- maybe here?
            this.socket.send(JSON.stringify({
                Hello: {Username: username, Settings: settings},
            }))
        })
        this.socket.addEventListener('message', this.onmessage.bind(this))
    }

    onmessage(e) {
        /** @type Message */
        const data = JSON.parse(e.data)
        if (data.SrvError != null) {
            console.error(data.SrvError)
            this.emit('error', data.SrvError)
            return
        }
        if (data.UserSync != null) {
            if (!data.UserSync.Partial) {
                this.users = data.UserSync.Presences
            } else {
                this.users = Object.assign(this.users, data.UserSync.Presences)
                Object.keys(this.users).forEach(k => {
                    if (this.users[k] == null)
                        delete this.users[k]
                })
            }
            delete this.users[this.me]
            this.emit('users', data.UserSync)
        }
        if (data.RecordSync != null) {
            if (!data.RecordSync.Partial) {
                this.records = data.RecordSync
                if (this.records.Latest == null)
                    this.records.Latest = [] // fix for go returning nil for empty slice
            } else {
                this.records.Best = Object.assign(this.records.Best, data.RecordSync.Best)
                this.records.Latest = (data.RecordSync.Latest || []).concat(this.records.Latest).slice(0, 10)
            }
            this.emit('records', data.RecordSync)
        }
        if (data.Hello != null) {
            this.me = data.Hello.Username
            this.emit('connected', {Username: data.Hello.Username})
        }
    }

    /**
     * Send message to server.
     * @param {Message} m
     */
    send(m) {
        if (this.socket == null)
            return
        delete m.Sender
        delete m.SrvError
        this.socket.send(JSON.stringify(m))
    }
}

/**
 * @typedef {object} Message
 * @property {?string} SrvError - Server error
 * @property {?HelloMessage} Hello
 * @property {?UserSyncMessage} UserSync
 * @property {?RoomUpdateMessage} RoomUpdate
 * @property {?RecordMessage} Record
 * @property {?RecordSyncMessage} RecordSync
 */
/**
 * @typedef {object} HelloMessage
 * @property {string} Username - Username signed in as
 * @property {RoomSettings} Settings - Settings for newly created room
 */
/**
 * @typedef {object} UserSyncMessage
 * @property {Presence[]} Presences - List of presences on server
 * @property {boolean} Partial - Whether this list is partial (update cached)
 */
/**
 * @typedef {object} RoomUpdateMessage
 * @property {RoomSettings} Settings
 */
/**
 * @typedef {object} RecordMessage
 * @property {MinesweeperMode} Mode
 * @property {MinesweeperDifficulty} Difficulty
 * @property {number} Time
 */
/**
 * @typedef {object} RecordSyncMessage
 * @property {Object.<MinesweeperDifficulty, MSRecord>} Best
 * @property {?MSRecord[]} Latest
 * @property {boolean} Partial - Whether this list is partial (update cached)
 */
/**
 * @typedef {object} Presence
 * @property {string} Username
 * @property {Room} CurrentRoom
 * TODO?
 */
/**
 * @typedef {RecordMessage} MSRecord
 * @property {string} Username
 */
/**
 * @typedef {RoomSettings} Room
 * @property {string} Id
 * @property {string} Owner
 */
/**
 * @typedef {object} RoomSettings
 * @property {MinesweeperMode} Mode
 * @property {MinesweeperDifficulty} Difficulty
 * @property {number} H - Height of field
 * @property {number} W - Width of field
 * @property {number} N - Number of mines
 */

import Emitter from 'component-emitter'

export class P2PManager extends Emitter {
    constructor() {
        super()

        this.peers = {}
        this.peers_send = {}
        this.room_to_peers = {}
    }

    join(peer, room, move = true) {
        console.log('join()', peer, room)
        const pc = new RTCPeerConnection({
            iceServers: [{
                urls: 'stun://stun.l.google.com:19302',
            }],
        })
        this.peers[peer] = pc
        this.room_to_peers[room] = (this.room_to_peers[room] || [])
        this.room_to_peers[room].push(peer)

        pc.onicecandidate = this.onicecandidate.bind(this, peer, room)
        pc.onnegotiationneeded = this.onnegotiationneeded.bind(this, peer, room)
        pc.oniceconnectionstatechange = this.oniceconnectionstatechange.bind(this, peer, room)

        const ch = pc.createDataChannel(room, {negotiated: true, id: 0, ordered: true})
        ch.onopen = () => {
            this.peers_send[peer] = msg => ch.send(msg)
            this.emit('join', room, peer, move)
        }
        ch.onmessage = e => {
            this.emit('message', room, peer, e.data)
        }
        ch.onclose = () => {
            // Close if the RTC connection didn't do it itself
            if (this.peers.hasOwnProperty(peer))
                this.peers[peer].close()
        }
    }

    send(peer, msg) {
        this.peers_send[peer](JSON.stringify(msg))
    }
    sendall(room, msg) {
        if (!this.room_to_peers.hasOwnProperty(room))
            return
        for (const peer of this.room_to_peers[room])
            this.send(peer, msg)
    }

    close(peer) {
        this.peers[peer].close()
    }
    closeall(room) {
        if (!this.room_to_peers.hasOwnProperty(room))
            return
        for (const peer of this.room_to_peers[room])
            this.close(peer)
    }

    onsignal(signalmsg) {
        console.log('signal()', signalmsg.Username, signalmsg.RoomId)
        const peer = signalmsg.Username
        if (this.peers[peer] == null)
            this.join(peer, signalmsg.RoomId, false)
        const pc = this.peers[peer]

        if (signalmsg.Offer) {
            pc.setRemoteDescription(JSON.parse(signalmsg.Offer).desc).
                then(() => pc.createAnswer()).
                then(answer => pc.setLocalDescription(answer)).
                then(() => {
                    this.emit('signal',
                        {Username: peer, RoomId: signalmsg.RoomId, Answer: JSON.stringify({desc: pc.localDescription})})
                }).
                catch(err => console.error(err))
        } else if (signalmsg.Answer) {
            pc.setRemoteDescription(JSON.parse(signalmsg.Answer).desc).catch(err => console.error(err))
        } else if (signalmsg.Candidate) {
            pc.addIceCandidate(JSON.parse(signalmsg.Candidate).candidate).catch(err => console.error(err))
        }
    }

    onicecandidate(peer, room, e) {
        console.log('onicecandidate()', peer, room, e)
        if (e.candidate)
            this.emit('signal', {Username: peer, RoomId: room, Candidate: JSON.stringify({candidate: e.candidate})})
    }

    onnegotiationneeded(peer, room, e) {
        console.log('onnegotiationneeded()', peer, room, e)
        this.peers[peer].createOffer().
            then(offer => this.peers[peer].setLocalDescription(offer)).
            then(() => {
                this.emit('signal', {Username: peer, RoomId: room,
                    Offer: JSON.stringify({desc: this.peers[peer].localDescription})})
            }).
            catch(err => console.error(err))
    }

    oniceconnectionstatechange(peer, room, e) {
        console.log('oniceconnectionstatechange()', peer, room, e)
        if (!this.peers.hasOwnProperty(peer))
            return
        // eslint-disable-next-line max-len
        if (this.peers[peer].iceConnectionState === 'disconnected' || this.peers[peer].iceConnectionState === 'closed') {
            console.log('leave', room, peer)
            this.emit('leave', room, peer)
            this.peers[peer].close()

            delete this.peers_send[peer]
            delete this.peers[peer]
            const i = this.room_to_peers[room].indexOf(peer)
            if (i !== -1) {
                this.room_to_peers[room].splice(i, 1)
                if (this.room_to_peers[room].length === 0)
                    delete this.room_to_peers[room]
            }
        }
    }
}

export class Server extends Emitter {
    constructor() {
        super()

        this.socket = null

        this.me = null
        /** @type ?Room */
        this.room = null
        this.host = true
        this.users = {}
        this.records = {Best: {}, Latest: []}
    }

    connect(username, settings) {
        this.socket = new WebSocket('ws://192.168.1.210:8080') // wss://mines.rsid.gq/server
        this.socket.addEventListener('close', e => {
            localStorage.removeItem('username')
            console.error(e)
            this.emit('error', 'Connection failed.')
            this.emit('broadcast', 'Lost server connection. Try /CONNECT to reconnect.')
        })
        this.socket.addEventListener('open', () => {
            // TODO maybe other data?
            this.socket.send(JSON.stringify({
                Hello: {Username: username, Room: this.room ? this.room : settings},
            }))
        })
        this.socket.addEventListener('message', this.onmessage.bind(this))
    }

    onmessage(e) {
        /** @type Message */
        const data = JSON.parse(e.data)
        if (data.SrvError != null) {
            console.error(data.SrvError)
            this.emit('error', 'Error: ' + data.SrvError)
            return
        }
        if (data.RoomP2P != null)
            this.emit('signal', data.RoomP2P)
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
            let became_host = false
            if (this.users.hasOwnProperty(this.me)) {
                const oldroom = this.room.Id
                this.room = this.users[this.me].CurrentRoom
                became_host = !this.host && this.room.Owner === this.me && this.room.Id === oldroom
                this.host = this.room.Owner === this.me
                delete this.users[this.me]
            }
            this.emit('users', data.UserSync, became_host)
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
            this.room = data.Hello.Room
            this.host = true
            this.emit('connected', data.Hello)
        }
        if (data.Chat != null) {
            if (data.Sender != null)
                this.emit('chat', data.Sender, data.Chat)
            else
                this.emit('broadcast', data.Chat)
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
 * @property {?string} Chat - Text accompanying event
 * @property {?HelloMessage} Hello
 * @property {?UserSyncMessage} UserSync
 * @property {?RoomUpdateMessage} RoomUpdate
 * @property {?RoomP2PMessage} RoomP2P
 * @property {?RecordMessage} Record
 * @property {?RecordSyncMessage} RecordSync
 */
/**
 * @typedef {object} HelloMessage
 * @property {string} Username - Username signed in as
 * @property {Room} Room - Newly created room (or from client setting parameters)
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
 * @typedef {object} RoomP2PMessage
 * @property {string} Username
 * @property {string} RoomId
 * @property {string} Offer
 * @property {string} Answer
 * @property {string} Candidate
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

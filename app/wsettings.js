import {MinesweeperDifficulty as MSDifficulty} from './common'

const DIFFICULTIES = {
    [MSDifficulty.Beginner]:     {H: 9,  W: 9,  N: 10}, // eslint-disable-line no-multi-spaces
    [MSDifficulty.Intermediate]: {H: 16, W: 16, N: 40},
    [MSDifficulty.Expert]:       {H: 16, W: 30, N: 99},
    [MSDifficulty.Extreme]:      {H: 24, W: 30, N: 199},
}

export default class SettingsWindow {
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

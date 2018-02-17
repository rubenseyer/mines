import {MinesweeperDifficulty as MSDifficulty, MinesweeperMode as MSMode} from './common'

export default class RecordsToolWindow {
    constructor(alltime, local, recent) {
        this.alltime = alltime
        this.local = local
        this.recent = recent
    }

    /* eslint-disable max-len */
    update(rr) {
        // TODO partial updates (param)
        const alltime = this.alltime
        while (alltime.firstChild)
            alltime.removeChild(alltime.firstChild)
        row(alltime, rr.Best[MSDifficulty.Beginner], MSDifficulty.str(MSDifficulty.Beginner))
        row(alltime, rr.Best[MSDifficulty.Intermediate], MSDifficulty.str(MSDifficulty.Intermediate))
        row(alltime, rr.Best[MSDifficulty.Expert], MSDifficulty.str(MSDifficulty.Expert))
        row(alltime, rr.Best[MSDifficulty.Extreme], MSDifficulty.str(MSDifficulty.Extreme))
        const local = this.local
        while (local.firstChild)
            local.removeChild(local.firstChild)
        row(local, JSON.parse(localStorage.getItem('record-' + MSDifficulty.Beginner)), MSDifficulty.str(MSDifficulty.Beginner))
        row(local, JSON.parse(localStorage.getItem('record-' + MSDifficulty.Intermediate)), MSDifficulty.str(MSDifficulty.Intermediate))
        row(local, JSON.parse(localStorage.getItem('record-' + MSDifficulty.Expert)), MSDifficulty.str(MSDifficulty.Expert))
        row(local, JSON.parse(localStorage.getItem('record-' + MSDifficulty.Extreme)), MSDifficulty.str(MSDifficulty.Extreme))
        const recent = this.recent
        while (recent.firstChild)
            recent.removeChild(recent.firstChild)
        for (const r of rr.Latest) {
            const d = document.createElement('div')
            d.classList.add('list-entry')
            d.innerHTML = `<span>${r.Username}</span>&nbsp;<span>${MSMode.str(r.Mode)}, ${MSDifficulty.str(r.Difficulty)}</span>&nbsp;<span>${~~(r.Time / 1000) + 1}</span>` // eslint-disable-line max-len
            recent.appendChild(d)
        }
    }
    /* eslint-enable max-len */
}

function row(t, r, long) {
    if (r == null)
        return
    const tr = document.createElement('tr')
    tr.innerHTML = `<td><em>${long}</em></td><td>${r.Username}</td><td>${r.Time / 1000}</td>`
    t.appendChild(tr)
}

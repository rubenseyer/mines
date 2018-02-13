/**
 * @readonly
 * @enum {number}
 */


export const GridStateEnum = Object.freeze({
    Question: -3, // unused
    Unknown: -2,
    Flag: -1,

    N0: 0,
    N1: 1,
    N2: 2,
    N3: 3,
    N4: 4,
    N5: 5,
    N6: 6,
    N7: 7,
    N8: 8,

    MineRevealed: 64,
    MineClicked: 65,
    WrongFlag: 66,
})

/**
 * @readonly
 * @enum {string}
 */
export const MinesweeperMode = Object.freeze({
    Solo: 'solo',
    Coop: 'coop',
    Race: 'race',
    Attack: 'attack',

    str(s) {
        switch (s) {
        case MinesweeperMode.Solo:
            return 'Solo'
        case MinesweeperMode.Coop:
            return 'Co-op'
        case MinesweeperMode.Race:
            return 'Race'
        case MinesweeperMode.Attack:
            return 'Attack'
        default:
            return 'Unknown'
        }
    },
})

/**
 * @readonly
 * @enum {string}
 */
export const MinesweeperDifficulty = Object.freeze({
    Beginner: 'beg',
    Intermediate: 'int',
    Expert: 'exp',
    Extreme: 'ext',
    Custom: 'cus',

    str(s) {
        switch (s) {
        case MinesweeperDifficulty.Beginner:
            return 'Beginner'
        case MinesweeperDifficulty.Intermediate:
            return 'Intermediate'
        case MinesweeperDifficulty.Expert:
            return 'Expert'
        case MinesweeperDifficulty.Extreme:
            return 'Extreme'
        default:
            return 'Custom'
        }
    },
})

export const DistinctColors = Object.freeze([
    '#FF0000',
    '#FFFF00',
    '#00EAFF',
    '#AA00FF',
    '#FF7F00',
    '#BFFF00',
    '#0095FF',
    '#FF00AA',
    '#FFD400',
    '#6AFF00',
])

export function djb2(str) {
    let hash = 5381
    let i = str.length
    while (i--)
        hash = ((hash << 5) + hash) + str.charCodeAt(i)
    return hash
}

/**
 * Valid RNG for minefield generators
 * @interface RNG
 */
/**
 * Generate random number in [0,max)
 * @function
 * @name RNG#uint32_range
 * @param {number} max - End of range, exclusive.
 * @returns {number} A random integer in the specified range
 */

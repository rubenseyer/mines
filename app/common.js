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
 * Valid RNG for minefield generators
 * @interface RNG
 */
/**
 * Generate random number in [0,max)
 * @function
 * @name RNG#uint32_range
 * @param {max} End of range, exclusive.
 * @returns {number} A random integer in the specified range
 */

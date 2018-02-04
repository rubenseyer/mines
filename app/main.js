//import '../lib/vendor/onresize'
import '../lib/dragable' // FIXME: side effect import for html, make this better later
import {GameState} from 'game'
import {GameWindow} from 'ui'

// TODO Make this a real application
window.renderer = new GameWindow(document.getElementsByClassName('minefield')[0],
    new GameState(16, 30, 99), document.getElementsByClassName('indicator'))
document.getElementsByClassName('yellow')[0].addEventListener('click',
    () => window.renderer.init(null, new GameState(16, 30, 99), null))

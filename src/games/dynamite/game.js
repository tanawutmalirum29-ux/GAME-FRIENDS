import './dynamite-art.js';
import './dynamite.js';

const engine=window.Dynamite;
if(!engine ||
  typeof engine.setup!=='function' ||
  typeof engine.update!=='function' ||
  typeof engine.draw!=='function' ||
  typeof engine.getResult!=='function') {
  throw new Error('DYNAMITE game engine does not satisfy the mini-game API');
}
export default engine;

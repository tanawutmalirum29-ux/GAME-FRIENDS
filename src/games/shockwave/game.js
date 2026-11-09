import './shockwave.js';
const engine=window.Shockwave;
if(!engine)throw Error('Missing Shockwave game engine');
export default engine;

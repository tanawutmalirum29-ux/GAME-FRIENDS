/* Match the actual running core without assigning numbered game releases. */
function gfConnectionHello(){
 const core=String(window.GAME_CORE_HASH||'');
 return /^[a-f0-9]{20}$/.test(core)?{coreHash:core}:{};
}
function gfConnectionCompatible(packet){
 // Reject obsolete numeric release tokens even when a Core hash matches.
 if(packet&&Object.hasOwn(packet,'protocolVersion'))return false;
 const expected=gfConnectionHello();
 // Development fixtures have no generated core fingerprint.
 if(!expected.coreHash)return true;
 return !!packet&&packet.coreHash===expected.coreHash;
}

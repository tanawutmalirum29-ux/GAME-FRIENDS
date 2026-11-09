/* Core fingerprint and transport compatibility for live multiplayer connections. */
const GF_TRANSPORT_PROTOCOL=1;
function gfConnectionHello(){
 const core=String(window.GAME_CORE_HASH||'');
 return /^[a-f0-9]{20}$/.test(core)?{protocolVersion:GF_TRANSPORT_PROTOCOL,coreHash:core}:{};
}
function gfConnectionCompatible(packet){
 const expected=gfConnectionHello();
 // Local source HTML has no deployment fingerprint; do not break offline
 // regression harnesses. Real AWS builds always carry a SHA fingerprint.
 if(!expected.coreHash)return true;
 return !!packet&&packet.protocolVersion===GF_TRANSPORT_PROTOCOL&&
  packet.coreHash===expected.coreHash;
}

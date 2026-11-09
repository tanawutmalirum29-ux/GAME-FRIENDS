/* Host-authoritative transport contract; versioned Core and plugin UX. */
const GF_TRANSPORT_PROTOCOL=1;
function gfVersionHello(){
 const core=String(window.GAME_CORE_VERSION||'');
 return /^[a-f0-9]{20}$/.test(core)?{protocolVersion:GF_TRANSPORT_PROTOCOL,coreHash:core}:{};
}
function gfVersionsCompatible(packet){
 const expected=gfVersionHello();
 // Local source HTML has no versioned build manifest; do not break offline
 // regression harnesses. Real AWS builds always carry a SHA fingerprint.
 if(!expected.coreHash)return true;
 return !!packet&&packet.protocolVersion===GF_TRANSPORT_PROTOCOL&&
  packet.coreHash===expected.coreHash;
}

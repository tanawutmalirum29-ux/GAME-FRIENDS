# Offline game assets

The service worker caches only \`game-assets/<id>/<content-hash>/...\` and
a last-successful, network-first \`game-catalog.json\`. It neither navigates
the page nor intercepts HTML, core JavaScript or multiplayer traffic.
It limits the asset cache to 120 requests; browser storage can be evicted.
Games can be replayed offline only after their assets and compatible catalog
were previously downloaded; fresh games cannot appear offline.

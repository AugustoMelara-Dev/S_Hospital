# Checksums

El paquete `offline-release/` es un artefacto local ignorado por Git. Su `checksums.sha256` y los `*.tar.sha256` se regeneran con `scripts/make_offline_release.ps1` y se verifican con `scripts/assert_offline_release_clean.ps1` antes del cutover.

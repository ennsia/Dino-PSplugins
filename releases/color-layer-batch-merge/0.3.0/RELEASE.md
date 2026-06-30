# Color Layer Batch Merge 0.3.0

Installable Dino-branded release for the safe duplicate document batch color-layer merge workflow.

## Included

- `Dino-color-layer-batch-merge_PS.ccx`: recommended installer
- `README_TEST_CN.txt`: Chinese installation, usage, and testing notes
- `color-layer-batch-merge-v0.3.0-offline.zip`: complete offline package
- `SHA256SUMS.txt`: artifact checksums

## Changes

- Recursively expands nested target groups before planning merges.
- Uses structural locators to resolve target layers in the duplicated document.
- Hides original copied color source layers after merge completion to avoid double color application.
- Keeps the original document untouched by executing destructive operations only in a full document duplicate.
- Preserves the dry-run and panel confirmation workflow introduced in earlier 0.2.x builds.

## Verified

- Manifest version is `0.3.0`.
- Packaged with the repository `package:plugin` entrypoint via `scripts/package-plugin.mjs`.
- Release directory contains the CCX installer and offline zip generated from the same package run.
- CCX package structure and SHA256 checks pass.

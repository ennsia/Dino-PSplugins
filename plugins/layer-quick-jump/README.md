# Layer Quick Jump

Photoshop UXP panel for saving three frequently used layer or layer-group positions, then jumping back to them from anywhere in the current document.

## Current Features

- Three record slots: `记录 1`, `记录 2`, and `记录 3`.
- Saves the currently selected layer or layer group into a slot.
- Jumps back to the saved layer or layer group with one click.
- Stores records locally in the plugin panel, so they survive panel reloads.
- Warns when the active document is not the one used when the record was saved.

## Target Host

- Photoshop 2025-era UXP host support.
- Manifest target: Photoshop `25.0.0` or newer.

## Load in Photoshop

1. Open Adobe UXP Developer Tool.
2. Add this folder as a plugin.
3. Load it into Photoshop.
4. Open the panel from Photoshop's Plugins menu.

## Package

From the repository root:

```bash
npm run package:layer-quick-jump
```

This creates a release artifact under `dist/layer-quick-jump/0.1.0/`:

- `layer-quick-jump-v0.1.0.ccx`

The source files in this plugin folder remain the canonical version for study and modification.

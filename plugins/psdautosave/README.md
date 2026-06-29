# psdautosave

psdautosave is a Photoshop UXP panel MVP for creating guarded local PSD/PSB backup copies of the active document.

## Current Scope

- Choose one local backup folder.
- Bind one current PSD/PSB as the backup target.
- Back up only the bound target document, never an unrelated temporary active document.
- Support local `.psd` and `.psb` documents.
- Save backup files directly into the chosen folder.
- Use timestamped names such as `character__autosave__20260629_193000.psd`.
- Add `_01`, `_02`, and so on when a backup name already exists.
- Run manually or on one interval: 30 minutes, 1 hour, or 2 hours.
- Use a single timer and clear the previous timer whenever the interval changes.
- Show a simple elapsed timer after automatic backup is enabled. It accumulates timer ticks while psdautosave is active, not wall-clock time while Photoshop is closed or the panel script is suspended.
- Keep a conservative single-column layout that remains usable while the Photoshop panel is resized.
- When the bound target is not the active document, psdautosave attempts to save the already-open bound document directly. If Photoshop UXP cannot do this silently, the operation fails with a panel/log message instead of switching documents.

## Safety Rules

- The plugin never deletes backup files.
- The plugin never overwrites the original PSD/PSB.
- The plugin creates backup files with `overwrite: false`.
- The plugin attempts to use Photoshop UXP `document.saveAs.psd/psb(file, options, true)` so the operation is a save-as-copy.
- The plugin reports unsupported documents, unsaved documents, missing folder permissions, and backup failures in the panel.
- The plugin writes a small diagnostic log named `psdautosave-latest.log` in its UXP data folder.
- The plugin does not intentionally switch the active Photoshop document during backup.

## Known MVP Limitations

- Photoshop save-as-copy behavior must still be verified on real Photoshop versions before this is promoted beyond MVP.
- This version does not create a restore center, backup index, retention policy, or automatic cleanup.
- Folder permissions may need to be re-selected after Photoshop or UXP permission changes.
- Panel layout intentionally avoids CSS Grid and keeps the minimum width at 260 px for better Photoshop side-panel docking.
- The panel keeps the minimum height low and uses plain document scrolling so users can resize it without losing access to status rows.
- Photoshop controls first-open panel placement; this plugin can size for docking but cannot force itself into an existing collapsed sidebar group.

## Development

Load `plugins/psdautosave/` with Adobe UXP Developer Tool during development.

Useful checks from the repository root:

```bash
npm run lint
node tests/psdautosave.test.cjs
npm run package:plugin -- psdautosave
```

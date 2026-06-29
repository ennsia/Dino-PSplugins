# Photoshop UXP Panel Compatibility Notes

These notes capture local pitfalls found while developing the personal Photoshop plugin set.

## Layout

- Prefer flexbox and simple block flow for panel controls.
- Avoid CSS Grid for important buttons until it has been verified in the target Photoshop UXP host.
- Avoid fragile semantic layouts such as `dl > div` for status tables; plain `div` rows are safer in embedded panels.
- Keep dockable panel minimum widths around 260 px unless a feature has a hard reason to be wider.
- Keep minimum heights modest too; large minimum heights can make first-run floating panels harder to place in cramped Photoshop workspaces.
- Avoid combining `height: 100%`, root-level custom scroll containers, media-query compaction, and wrapped flex command rows unless the exact Photoshop UXP host has been visually verified. This combination caused overlapping sections in psdautosave during panel resizing.
- Prefer plain document scrolling (`body { overflow-y: auto; }`) and a conservative single-column command layout for small utility panels.

## Panel Placement

Photoshop controls where a newly installed panel opens. `preferredDockedSize` helps sizing, but it does not force a panel into an existing sidebar group. Design first-run panels so they are usable as either a floating panel or a narrow docked panel.

UXP plugins cannot reliably force "open already collapsed into the right icon rail" behavior. Treat the first manual drag into a sidebar group as a host-level setup step.

## Runtime Debugging

For MVP tools with file operations, add a plugin data-folder diagnostic log before handing a build to the user. The log should record initialization, permission recovery, user folder choices, timer changes, operation start/success/failure, and skipped reentrant operations.

For UI elapsed timers, do not show wall-clock elapsed time from a saved start timestamp unless that is explicitly the product meaning. For "tool runtime" counters, persist an accumulated runtime value and add time from timer ticks while the UXP JavaScript context is alive and the feature is enabled. Cap single tick deltas so sleep, suspension, or hidden-panel throttling does not backfill large wall-clock gaps.

For auto-save tools, prefer an explicit bound target document over silently following `activeDocument`. If a user switches to another PSD, a timer should not accidentally back up the temporary active file. Attempt non-active bound-document backup only when it does not switch Photoshop focus; otherwise report and skip.

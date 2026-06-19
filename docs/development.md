# Development Notes

## Local Workflow

1. Edit a plugin inside `plugins/<plugin-name>/`.
2. Run `npm run lint`.
3. Run the plugin-specific tests when available.
4. Build CCX, ZIP, or CEP packages only when they are useful for the current release.
5. Check `docs/install-findings.md` for known Adobe install path failures.
6. Test inside Photoshop with a disposable document when possible.

## Publishing Checklist

- The plugin folder has its own README and usage notes.
- The UXP plugin has a valid `manifest.json`, or the CEP plugin has a valid `CSXS/manifest.xml`.
- Source files are the required archival deliverable.
- Generated CCX or ZIP artifacts are optional and must be reviewed before publishing.
- No private files, API keys, PSD/PSB files, or local-only paths are committed.
- Untested implementations are clearly marked as beta, prototype, or experiment.

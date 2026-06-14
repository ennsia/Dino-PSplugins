# Development Notes

## Local Workflow

1. Edit a plugin inside `plugins/<plugin-name>/`.
2. Run `npm run lint`.
3. Reload the plugin in Adobe UXP Developer Tool.
4. Test inside Photoshop with a disposable document.

## Publishing Checklist

- The plugin folder has its own README.
- `manifest.json` has a stable `id`, `name`, and `version`.
- No private files, API keys, PSD/PSB files, or local-only paths are committed.
- The plugin has been loaded successfully in UXP Developer Tool.

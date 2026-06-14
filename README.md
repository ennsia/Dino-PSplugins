# Photoshop Plugins

A public collection of Photoshop UXP plugins and small creative tooling experiments.

## Plugins

| Plugin | Status | Description |
| --- | --- | --- |
| `stray-stroke-cleaner` | Prototype | A Photoshop panel for reviewing and preparing stray-stroke cleanup workflows. |

## Repository Structure

```text
photoshop-plugins/
  plugins/
    stray-stroke-cleaner/
      manifest.json
      index.html
      src/
  scripts/
    validate-manifests.mjs
  docs/
```

## Getting Started

1. Install Adobe UXP Developer Tool.
2. Open UXP Developer Tool and choose **Add Plugin**.
3. Select a plugin folder, for example `plugins/stray-stroke-cleaner`.
4. Load the plugin into Photoshop.

## Development

Run the local manifest check before publishing changes:

```bash
npm run lint
```

## Notes

This repository is intentionally small at the start. Each plugin should keep its own README, manifest, source files, and release notes so the collection can grow without becoming hard to navigate.

## License

MIT

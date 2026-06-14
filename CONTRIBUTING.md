# Contributing

Thanks for helping improve this Photoshop plugin collection.

## Plugin Guidelines

- Keep each plugin in its own folder under `plugins/`.
- Include a `manifest.json`, plugin source files, and a plugin-specific `README.md`.
- Keep plugin installation notes focused on source loading and optional `.ccx` release artifacts.
- Do not commit generated packages unless they are intentionally part of a reviewed release.
- Keep generated assets and private Photoshop documents out of Git.
- Prefer small, reviewable changes.
- Run `npm run lint` before opening a pull request.

## Commit Style

Use short, direct commit messages:

```text
Add initial cleanup panel
Fix manifest validation
Document UXP loading steps
```

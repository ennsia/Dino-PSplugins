# Contributing

Thanks for helping improve this Photoshop plugin collection.

## Plugin Guidelines

- Keep each plugin in its own folder under `plugins/`.
- Include a UXP `manifest.json` or CEP `CSXS/manifest.xml`, plugin source files, and a plugin-specific `README.md`.
- Treat source code as the primary open-source and archival deliverable.
- Treat `.ccx` and `.zip` files as optional reviewed release artifacts.
- Name CCX artifacts `Eisen-<plugin-name>_<host>.ccx`.
- Read `docs/install-findings.md` before adding a new installer path.
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

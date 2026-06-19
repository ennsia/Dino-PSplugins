# Dino PS Plugins Releases

Testable release artifacts are organized by plugin and version:

```text
releases/<plugin-name>/<version>/
```

Each release should contain:

- `Dino-<plugin-name>_<host>.ccx`
- Chinese test and installation notes
- Optional reviewed ZIP artifacts when useful
- `SHA256SUMS.txt`

Generated working files remain under the ignored `dist/` directory. Only reviewed artifacts are copied into `releases/`.

Releases before the Dino rename may retain their original Eisen filenames for checksum and history integrity.

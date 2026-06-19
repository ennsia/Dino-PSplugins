# Eisen PS Plugins Releases

Testable release artifacts are organized by plugin and version:

```text
releases/<plugin-name>/<version>/
```

Each release should contain:

- `Eisen-<plugin-name>_<host>.ccx`
- Chinese test and installation notes
- The complete offline ZIP
- `SHA256SUMS.txt`

Generated working files remain under the ignored `dist/` directory. Only reviewed artifacts are copied into `releases/`.

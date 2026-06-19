# Layer Quick Jump CEP

CEP fallback build for offline-first installation testing.

This version targets Photoshop's CEP panel runtime instead of UXP. It exists because direct UXP folder copying did not make third-party UXP plugins appear in Photoshop 2025.

## Install Test

Use the generated offline package and run:

```text
INSTALL_CEP_LOCAL.command
```

Then restart Photoshop and check:

```text
Window > Extensions
```

or the Photoshop extensions/panels menu for `Layer Quick Jump CEP`.

## Notes

- This is a test build.
- It enables CEP debug mode for unsigned local extensions.
- It stores three records in browser localStorage.

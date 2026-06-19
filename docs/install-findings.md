# Install Findings

This project is offline-first. Installation research is tracked here so future plugins do not repeat failed Adobe packaging paths.

## Confirmed On This Machine

- Date: 2026-06-19
- Host app: Adobe Photoshop 2025
- UXP plugin tested: `plugins/layer-quick-jump`
- CEP plugin tested: `plugins/layer-quick-jump-cep`

## Findings

### CCX Structure Is Confirmed

Renaming an arbitrary plugin zip to `.ccx` fails in Creative Cloud Desktop with install error code `-4`.

Adobe UXP Developer Tool's packaging implementation was inspected. It validates icon declarations, converts the host array to a host object for the packaged manifest, and writes a ZIP-compatible CCX. The repository packager now reproduces and verifies that structure.

`layer-quick-jump` 0.1.0 was successfully installed on 2026-06-19. Adobe UPI recorded it as a UXP extension with `InstallSource=doubleClick`, and Photoshop registered it in `PluginsInfo/v1/PS.json`.

Project rule: every CCX must pass `scripts/verify-ccx.mjs` and include all declared `@1x` and `@2x` icons.

### UXP Developer Tools Is Not User-Friendly Offline

Adobe UXP Developer Tools can show `Sign-In Required` even when Creative Cloud Desktop appears signed in. Its local log showed:

```text
check-user-authentication: false
```

Project rule: do not require normal users to install or open UXP Developer Tools.

### Direct UXP Folder Copy Failed

The plugin folder was successfully copied into both locations:

```text
~/Library/Application Support/Adobe/UXP/extensions/com.makienn.photoshop.layer-quick-jump
/Library/Application Support/Adobe/UXP/extensions/com.makienn.photoshop.layer-quick-jump-0.1.0
```

Photoshop 2025 did not show the plugin in the Plugins menu.

Project rule: direct UXP folder copy is not considered a working offline install path for third-party plugins unless future testing proves otherwise.

### Unified Plugin Installer Is The CCX Entry Point

The machine has Adobe Unified Plugin Installer Agent:

```text
/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app
```

It supports commands such as:

```text
--install <extension-file-path>
--remove <extension-name>
--list <all || product display name>
```

The installer can be invoked with:

```text
UnifiedPluginInstallerAgent --install <extension-file-path>
```

It still expects Creative Cloud Desktop services to be running. In a restricted shell it returned status `-645`, so normal release packages use `open <file.ccx>` through `INSTALL_CCX.command`.

Project rule: offline packages include all files locally and may use Creative Cloud Desktop only as the local CCX installation entry point. Plugin runtime must not require network access.

### CEP Is Present In Photoshop 2025, But User-Level Copy Failed

The installed Photoshop 2025 app contains:

```text
/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app/Contents/MacOS/CEPHtmlEngine.app
/Applications/Adobe Photoshop 2025/Adobe Photoshop 2025.app/Contents/Resources/CEP/extensions
/Library/Application Support/Adobe/CEP/extensions
```

The CEP test package installed into:

```text
~/Library/Application Support/Adobe/CEP/extensions/com.makienn.photoshop.layer-quick-jump-cep
```

The panel still did not appear in Photoshop.

Project rule: CEP user-level copy is not a proven offline path on this machine. If CEP is explored further, test the system-level CEP directory next:

```text
/Library/Application Support/Adobe/CEP/extensions
```

## Current Recommendation

For `layer-quick-jump`:

1. Ship a verified CCX as the primary working installer.
2. Ship an offline zip containing the same CCX, full plugin files, Chinese instructions, checks, and diagnostics.
3. Keep direct UXP and CEP copies documented only as failed experiments.

import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginName = process.argv[2];

if (!pluginName) {
  console.error("Usage: npm run package:plugin -- <plugin-name>");
  process.exit(1);
}

const pluginDir = join(rootDir, "plugins", pluginName);
const manifestPath = join(pluginDir, "manifest.json");

if (!existsSync(manifestPath)) {
  console.error(`Plugin not found or missing manifest: ${pluginName}`);
  process.exit(1);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const safeVersion = String(manifest.version || "0.0.0").replace(/[^a-z0-9._-]/gi, "-");
const releaseName = `${pluginName}-v${safeVersion}`;
const distDir = join(rootDir, "dist", pluginName, safeVersion);
const packageHost = Array.isArray(manifest.host) ? manifest.host[0] : manifest.host;
const ccxFileName = `Eisen-${pluginName}_${packageHost.app}.ccx`;
const ccxPath = join(distDir, ccxFileName);
const offlinePath = join(distDir, `${releaseName}-offline.zip`);
const ccxGuidePath = join(distDir, "生成CCX说明.txt");
const releaseReadmePath = join(distDir, "README-测试说明.txt");
const releaseReadmeAsciiPath = join(distDir, "README_TEST_CN.txt");
const stagingDir = await mkdtemp(join(tmpdir(), `${pluginName}-package-`));

async function archiveDirectory(sourceDir, outputPath) {
  await mkdir(dirname(outputPath), { recursive: true });
  await rm(outputPath, { force: true });

  const dittoResult = spawnSync("ditto", ["-c", "-k", "--norsrc", sourceDir, outputPath], {
    encoding: "utf8",
  });

  if (dittoResult.status !== 0) {
    const zipResult = spawnSync("zip", ["-qry", outputPath, "."], {
      cwd: sourceDir,
      encoding: "utf8",
    });

    if (zipResult.status !== 0) {
      const details = zipResult.stderr || dittoResult.stderr || "No archive tool output.";
      throw new Error(`Failed to create archive: ${details}`);
    }
  }
}

function offlineInstallText() {
  return `# ${manifest.name} 离线安装说明

这个压缩包是本项目的完整离线交付包，已经包含同版本 CCX、插件源文件、中文说明和诊断脚本。插件运行时不需要联网。

## 推荐方式 A：安装包内 CCX

1. 退出 Photoshop。
2. 双击 INSTALL_CCX.command；也可以直接双击 ${ccxFileName}。
3. 按 Adobe 安装窗口提示完成安装。
4. 重新打开 Photoshop。
5. 在“增效工具 / Plugins”菜单中打开 ${manifest.name}。

CCX 文件和插件功能均已完整放在本地。Creative Cloud Desktop 只负责调用 Adobe 的本机插件安装服务；插件运行不需要网络资源。

## 备用方式 B：UXP Developer Tool 加载

1. 打开 Adobe UXP Developer Tool。
2. 点击 Add Plugin，选择解压后的 ${pluginName} 文件夹。
3. 点击 Load。
4. 在 Photoshop 的 Plugins 菜单中打开插件。

## 已知无效的诊断方式

- INSTALL_LOCAL.command 和 INSTALL_SYSTEM.command 仅供诊断。
- 2026-06-15 在 Photoshop 2025 上实测，直接复制 UXP 文件夹不会让插件出现在菜单中。
- 不建议普通用户使用这两条裸目录复制路线。

## 兼容性

- 目标版本：Photoshop ${packageHost.minVersion || "25.0.0"} 或更新版本。
- 2026-06-19 已确认 CCX 可被 Adobe UPI 安装并注册到 Photoshop 2025。
- 安装或升级后需要重启 Photoshop。
`;
}

function offlineInstallPlainText() {
  return offlineInstallText()
    .replace(/^# /gm, "")
    .replace(/^## /gm, "")
    .replace(/^- /gm, "· ");
}

function releaseReadmeText() {
  return `${manifest.name} ${safeVersion} 测试说明

插件用途

这是一个 Photoshop 图层快速跳转插件，可以保存三个常用图层或图层组位置。
无论当前选中了哪个图层，都可以点击“跳转”快速返回保存的位置。

兼容范围

· Photoshop 2025 左右版本
· Manifest 最低版本：Photoshop ${packageHost.minVersion || "25.0.0"}
· 当前版本已在 Photoshop 2025 / 26.11.0 上完成安装和基础功能验证
· 插件运行时不需要联网

推荐安装

1. 退出 Photoshop。
2. 双击 ${ccxFileName}。
3. 在 Adobe 插件安装窗口中确认安装。
4. 重新打开 Photoshop。
5. 从“增效工具 / Plugins”菜单打开 ${manifest.name}。

使用方法

1. 在 Photoshop 图层面板中选中一个图层或图层组。
2. 在插件的记录 1、记录 2 或记录 3 中点击“保存”。
3. 切换到其他图层。
4. 点击对应记录后的“跳转”，即可重新选中保存的图层。

测试重点

· 面板能否正常显示三条记录
· 普通图层和图层组能否保存
· 嵌套图层组中的图层能否保存和跳转
· 关闭并重新打开面板后，记录是否仍然存在
· 重启 Photoshop 后，记录是否仍然存在
· 图层被删除后，插件是否给出提示而不是报错

已知限制

· 记录与保存时的 Photoshop 文档绑定，切换到其他文档时不会跳错文件。
· 删除记录对应的图层后，需要重新保存该记录位。
· 安装或升级插件后需要重启 Photoshop。

反馈时请提供

· macOS 或 Windows 版本
· Photoshop 完整版本号
· 安装是否成功
· 面板截图
· 出问题前执行的操作
`;
}

function ccxGuideText() {
  return `${manifest.name} CCX 构建说明

重要说明：
本项目打包脚本复现 Adobe UXP Developer Tool 的 Package 结构转换，并在构建时校验 manifest、host 和图标资源。
不要把普通插件 zip 直接改名为 .ccx；缺少 Adobe 所需结构时会出现错误代码 -4。

当前脚本已经生成：
${ccxPath}
${offlinePath}

2026-06-19 已确认同结构 CCX 可由 Adobe Unified Plugin Installer 安装并注册到 Photoshop 2025。
`;
}

function collectIconPaths(pluginManifest) {
  const paths = [];

  for (const icon of pluginManifest.icons || []) {
    paths.push(icon.path);
  }

  for (const entrypoint of pluginManifest.entrypoints || []) {
    for (const icon of entrypoint.icons || []) {
      paths.push(icon.path);
    }
  }

  return paths;
}

async function validateForAdobePackaging(pluginManifest) {
  if (!packageHost || packageHost.app !== "PS") {
    throw new Error("The current packager expects a Photoshop host.");
  }

  if (!Array.isArray(pluginManifest.icons)) {
    throw new Error("Adobe packaging requires a top-level icons array.");
  }

  for (const entrypoint of pluginManifest.entrypoints || []) {
    if (entrypoint.type === "panel" && !Array.isArray(entrypoint.icons)) {
      throw new Error(`Adobe packaging requires icons for panel entrypoint ${entrypoint.id}.`);
    }
  }

  for (const iconPath of collectIconPaths(pluginManifest)) {
    if (!existsSync(join(pluginDir, iconPath))) {
      throw new Error(`Missing icon file: ${iconPath}`);
    }

    const extension = iconPath.includes(".") ? iconPath.slice(iconPath.lastIndexOf(".")) : "";
    const standardPath = iconPath.slice(0, -extension.length) + "@1x" + extension;
    const retinaPath = iconPath.slice(0, -extension.length) + "@2x" + extension;
    if (!existsSync(join(pluginDir, standardPath))) {
      throw new Error(`Missing 1x icon file: ${standardPath}`);
    }
    if (!existsSync(join(pluginDir, retinaPath))) {
      throw new Error(`Missing 2x icon file: ${retinaPath}`);
    }
  }
}

function offlineFirstText() {
  return `# 离线优先发布原则

本项目的核心发布策略是 offline-first。

## 原因

Creative Cloud Desktop、CCX 安装器和 Adobe UXP Developer Tool 都可能受到登录态、邮箱验证、授权缓存、网络连接和地区网络环境影响。普通用户不应该为了安装一个小工具，被迫排查 Adobe 账号状态。

## 项目规则

1. 离线 zip 是主交付物，必须内含同版本 CCX。
2. CCX 和完整源文件必须同时交付。
3. 普通用户安装路径必须尽量不依赖 UXP Developer Tool。
4. 离线包必须包含中文说明、txt 说明、安装脚本、卸载脚本和安装检查脚本。
5. 如果 UXP 直接离线安装被 Photoshop 阻断，必须把失败结果记录为项目事实，并评估替代技术路线。

## 当前安装路线

- 推荐入口：INSTALL_CCX.command 或直接双击包内 CCX
- 用户级 UXP 诊断脚本：INSTALL_LOCAL.command（已知不显示）
- 系统级 UXP 诊断脚本：INSTALL_SYSTEM.command（已知不显示）
- 安装检查脚本：CHECK_INSTALL.command
- 卸载脚本：UNINSTALL_LOCAL.command / UNINSTALL_SYSTEM.command
- 下一步推荐路线：CEP 离线版本

## 离线定义

离线包必须把安装所需文件全部放在本地，不下载远程运行资源。Adobe Creative Cloud Desktop 可以作为本机安装入口，但插件运行不能依赖登录或联网。
`;
}

function ccxInstallCommandText() {
  return `#!/bin/zsh
set -e
trap 'status=$?; echo ""; echo "启动安装失败，退出码：$status"; echo "也可以直接双击同目录中的 CCX 文件。"; echo ""; read -r "?按回车关闭窗口..."; exit $status' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CCX_PATH="$SCRIPT_DIR/${ccxFileName}"
CC_APP="/Applications/Utilities/Adobe Creative Cloud/ACC/Creative Cloud.app"

echo ""
echo "准备安装 ${manifest.name} ${safeVersion}"
echo "$CCX_PATH"
echo ""

if [ ! -f "$CCX_PATH" ]; then
  echo "ERROR: 找不到 CCX 文件，请完整解压离线包后再运行。"
  read -r "?按回车关闭窗口..."
  exit 1
fi

if [ -d "$CC_APP" ]; then
  open -g "$CC_APP"
  sleep 3
fi

open "$CCX_PATH"

echo "已交给 Adobe 插件安装器。请在弹出的窗口中确认安装。"
echo "安装完成后退出并重新打开 Photoshop。"
echo ""
read -r "?按回车关闭窗口..."
`;
}

function offlineFirstPlainText() {
  return offlineFirstText()
    .replace(/^# /gm, "")
    .replace(/^## /gm, "")
    .replace(/^- /gm, "· ");
}

function localInstallCommandText() {
  return `#!/bin/zsh
set -e
trap 'status=$?; echo ""; echo "脚本失败，退出码：$status"; echo "请把这个窗口里的信息发给开发者。"; echo ""; read -r "?按回车关闭窗口..."; exit $status' ERR

PLUGIN_ID="${manifest.id}"
PLUGIN_NAME="${manifest.name}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/${pluginName}"
DEST_BASE="$HOME/Library/Application Support/Adobe/UXP/extensions"
DEST_DIR="$DEST_BASE/$PLUGIN_ID"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo ""
echo "Installing $PLUGIN_NAME"
echo "Source: $SRC_DIR"
echo "Target: $DEST_DIR"
echo ""

if [ ! -f "$SRC_DIR/manifest.json" ]; then
  echo "ERROR: 找不到插件 manifest.json。请确认这个脚本和 ${pluginName} 文件夹在同一个解压目录里。"
  read -r "?按回车退出..."
  exit 1
fi

mkdir -p "$DEST_BASE"

if [ -d "$DEST_DIR" ]; then
  BACKUP_DIR="$DEST_DIR.backup-$STAMP"
  echo "发现已有安装，先备份到："
  echo "$BACKUP_DIR"
  mv "$DEST_DIR" "$BACKUP_DIR"
fi

/usr/bin/ditto "$SRC_DIR" "$DEST_DIR"

echo ""
echo "安装完成。"
echo "请重新打开 Photoshop，然后在 Plugins 菜单里查找 $PLUGIN_NAME。"
echo ""
echo "如果没有出现，说明 Photoshop 当前版本可能不扫描用户级 UXP extensions 目录。"
echo "这时可以把这个结果告诉开发者，再尝试 UXP Developer Tool 或真实 CCX 路径。"
echo ""
read -r "?按回车关闭窗口..."
`;
}

function systemInstallCommandText() {
  return `#!/bin/zsh
set -e
trap 'status=$?; echo ""; echo "脚本失败，退出码：$status"; echo "请把这个窗口里的信息发给开发者。"; echo ""; read -r "?按回车关闭窗口..."; exit $status' ERR

PLUGIN_ID="${manifest.id}"
PLUGIN_VERSION="${safeVersion}"
PLUGIN_NAME="${manifest.name}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/${pluginName}"
DEST_BASE="/Library/Application Support/Adobe/UXP/extensions"
DEST_DIR="$DEST_BASE/$PLUGIN_ID-$PLUGIN_VERSION"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo ""
echo "Installing $PLUGIN_NAME to system-level Adobe UXP extensions"
echo "Source: $SRC_DIR"
echo "Target: $DEST_DIR"
echo ""
echo "接下来会请求管理员密码，用来写入 /Library/Application Support/Adobe/UXP/extensions。"
echo "输入密码时 Terminal 不会显示星号，这是 macOS 的正常行为。"
echo ""

if [ ! -f "$SRC_DIR/manifest.json" ]; then
  echo "ERROR: 找不到插件 manifest.json。请确认这个脚本和 ${pluginName} 文件夹在同一个解压目录里。"
  read -r "?按回车退出..."
  exit 1
fi

sudo mkdir -p "$DEST_BASE"

if [ -d "$DEST_DIR" ]; then
  BACKUP_DIR="$DEST_DIR.backup-$STAMP"
  echo "发现已有系统级安装，先备份到："
  echo "$BACKUP_DIR"
  sudo mv "$DEST_DIR" "$BACKUP_DIR"
fi

sudo /usr/bin/ditto "$SRC_DIR" "$DEST_DIR"

if command -v xattr >/dev/null 2>&1; then
  sudo xattr -dr com.apple.quarantine "$DEST_DIR" >/dev/null 2>&1 || true
fi

echo ""
echo "系统级安装完成。"
echo "请重新打开 Photoshop，然后在 Plugins 菜单里查找 $PLUGIN_NAME。"
echo ""
echo "如果仍然没有出现，说明 Photoshop 当前版本可能不接受直接复制的第三方 UXP 插件。"
echo ""
read -r "?按回车关闭窗口..."
`;
}

function localUninstallCommandText() {
  return `#!/bin/zsh
set -e
trap 'status=$?; echo ""; echo "脚本失败，退出码：$status"; echo "请把这个窗口里的信息发给开发者。"; echo ""; read -r "?按回车关闭窗口..."; exit $status' ERR

PLUGIN_ID="${manifest.id}"
DEST_DIR="$HOME/Library/Application Support/Adobe/UXP/extensions/$PLUGIN_ID"

echo ""
echo "Removing user-level install:"
echo "$DEST_DIR"
echo ""

if [ -d "$DEST_DIR" ]; then
  rm -rf "$DEST_DIR"
  echo "已移除用户级安装。"
else
  echo "没有找到用户级安装目录。"
fi

echo ""
read -r "?按回车关闭窗口..."
`;
}

function systemUninstallCommandText() {
  return `#!/bin/zsh
set -e
trap 'status=$?; echo ""; echo "脚本失败，退出码：$status"; echo "请把这个窗口里的信息发给开发者。"; echo ""; read -r "?按回车关闭窗口..."; exit $status' ERR

PLUGIN_ID="${manifest.id}"
PLUGIN_VERSION="${safeVersion}"
DEST_DIR="/Library/Application Support/Adobe/UXP/extensions/$PLUGIN_ID-$PLUGIN_VERSION"

echo ""
echo "Removing system-level install:"
echo "$DEST_DIR"
echo ""
echo "接下来会请求管理员密码。"
echo ""

if [ -d "$DEST_DIR" ]; then
  sudo rm -rf "$DEST_DIR"
fi

echo "已移除系统级安装。"
echo ""
read -r "?按回车关闭窗口..."
`;
}

function checkInstallCommandText() {
  return `#!/bin/zsh
set -e

PLUGIN_ID="${manifest.id}"
PLUGIN_VERSION="${safeVersion}"
USER_DIR="$HOME/Library/Application Support/Adobe/UXP/extensions/$PLUGIN_ID"
SYSTEM_DIR="/Library/Application Support/Adobe/UXP/extensions/$PLUGIN_ID-$PLUGIN_VERSION"

echo ""
echo "检查 ${manifest.name} 安装状态"
echo ""

echo "用户级目录："
echo "$USER_DIR"
if [ -d "$USER_DIR" ]; then
  echo "存在"
  ls -la "$USER_DIR"
else
  echo "不存在"
fi

echo ""
echo "系统级目录："
echo "$SYSTEM_DIR"
if [ -d "$SYSTEM_DIR" ]; then
  echo "存在"
  ls -la "$SYSTEM_DIR"
else
  echo "不存在"
fi

echo ""
read -r "?按回车关闭窗口..."
`;
}

try {
  await validateForAdobePackaging(manifest);
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const ccxStage = join(stagingDir, "ccx");
  const offlineStage = join(stagingDir, "offline");
  const offlinePluginDir = join(offlineStage, pluginName);

  await mkdir(ccxStage, { recursive: true });
  await mkdir(offlineStage, { recursive: true });
  await cp(pluginDir, ccxStage, {
    recursive: true,
    filter: (source) =>
      !source.includes("/.DS_Store") &&
      !source.endsWith(".ccx") &&
      !source.endsWith(".xdx"),
  });
  await cp(pluginDir, offlinePluginDir, {
    recursive: true,
    filter: (source) => !source.includes("/.DS_Store"),
  });

  const packagedManifest = JSON.parse(JSON.stringify(manifest));
  packagedManifest.host = packageHost;
  await writeFile(
    join(ccxStage, "manifest.json"),
    `${JSON.stringify(packagedManifest, null, 2)}\n`,
    "utf8"
  );
  await writeFile(join(offlineStage, "INSTALL_OFFLINE.md"), offlineInstallText(), "utf8");
  await writeFile(join(offlineStage, "安装说明.txt"), offlineInstallPlainText(), "utf8");
  await writeFile(join(offlineStage, "INSTALL_OFFLINE_CN.txt"), offlineInstallPlainText(), "utf8");
  await writeFile(join(offlineStage, "README-测试说明.txt"), releaseReadmeText(), "utf8");
  await writeFile(join(offlineStage, "README_TEST_CN.txt"), releaseReadmeText(), "utf8");
  await writeFile(join(offlineStage, "OFFLINE_FIRST.md"), offlineFirstText(), "utf8");
  await writeFile(join(offlineStage, "离线优先说明.txt"), offlineFirstPlainText(), "utf8");
  const localInstallCommandPath = join(offlineStage, "INSTALL_LOCAL.command");
  await writeFile(localInstallCommandPath, localInstallCommandText(), "utf8");
  await chmod(localInstallCommandPath, 0o755);
  const systemInstallCommandPath = join(offlineStage, "INSTALL_SYSTEM.command");
  await writeFile(systemInstallCommandPath, systemInstallCommandText(), "utf8");
  await chmod(systemInstallCommandPath, 0o755);
  const localUninstallCommandPath = join(offlineStage, "UNINSTALL_LOCAL.command");
  await writeFile(localUninstallCommandPath, localUninstallCommandText(), "utf8");
  await chmod(localUninstallCommandPath, 0o755);
  const systemUninstallCommandPath = join(offlineStage, "UNINSTALL_SYSTEM.command");
  await writeFile(systemUninstallCommandPath, systemUninstallCommandText(), "utf8");
  await chmod(systemUninstallCommandPath, 0o755);
  const checkInstallCommandPath = join(offlineStage, "CHECK_INSTALL.command");
  await writeFile(checkInstallCommandPath, checkInstallCommandText(), "utf8");
  await chmod(checkInstallCommandPath, 0o755);

  await archiveDirectory(ccxStage, ccxPath);
  await cp(ccxPath, join(offlineStage, ccxFileName));
  const ccxInstallCommandPath = join(offlineStage, "INSTALL_CCX.command");
  await writeFile(ccxInstallCommandPath, ccxInstallCommandText(), "utf8");
  await chmod(ccxInstallCommandPath, 0o755);
  await archiveDirectory(offlineStage, offlinePath);
  await writeFile(ccxGuidePath, ccxGuideText(), "utf8");
  await writeFile(releaseReadmePath, releaseReadmeText(), "utf8");
  await writeFile(releaseReadmeAsciiPath, releaseReadmeText(), "utf8");

  console.log(`Created ${resolve(ccxPath)}`);
  console.log(`Created ${resolve(offlinePath)}`);
  console.log(`Wrote ${resolve(ccxGuidePath)}`);
  console.log(`Wrote ${resolve(releaseReadmePath)}`);
  console.log(`Wrote ${resolve(releaseReadmeAsciiPath)}`);
} finally {
  await rm(stagingDir, { recursive: true, force: true });
}

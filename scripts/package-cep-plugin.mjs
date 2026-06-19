import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginName = process.argv[2];

if (!pluginName) {
  console.error("Usage: npm run package:layer-quick-jump-cep");
  process.exit(1);
}

const pluginDir = join(rootDir, "plugins", pluginName);
const manifestPath = join(pluginDir, "CSXS", "manifest.xml");

if (!existsSync(manifestPath)) {
  console.error(`CEP plugin not found or missing CSXS/manifest.xml: ${pluginName}`);
  process.exit(1);
}

const manifestXml = await readFile(manifestPath, "utf8");
const bundleId = manifestXml.match(/ExtensionBundleId="([^"]+)"/)?.[1] || pluginName;
const version = manifestXml.match(/ExtensionBundleVersion="([^"]+)"/)?.[1] || "0.0.0";
const panelName = manifestXml.match(/<Menu>([^<]+)<\/Menu>/)?.[1] || pluginName;
const releaseName = `${pluginName}-v${version}`;
const distDir = join(rootDir, "dist", pluginName, version);
const offlinePath = join(distDir, `${releaseName}-cep-offline.zip`);
const stagingDir = await mkdtemp(join(tmpdir(), `${pluginName}-cep-package-`));

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

function installScript() {
  return `#!/bin/zsh
set -e
trap 'status=$?; echo ""; echo "安装失败，退出码：$status"; echo "把这个窗口内容发给开发者。"; echo ""; read -r "?按回车关闭窗口..."; exit $status' ERR

EXT_ID="${bundleId}"
PANEL_NAME="${panelName}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/${pluginName}"
DEST_BASE="$HOME/Library/Application Support/Adobe/CEP/extensions"
DEST_DIR="$DEST_BASE/$EXT_ID"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo ""
echo "Installing $PANEL_NAME CEP"
echo "Source: $SRC_DIR"
echo "Target: $DEST_DIR"
echo ""

if [ ! -f "$SRC_DIR/CSXS/manifest.xml" ]; then
  echo "ERROR: 找不到 CSXS/manifest.xml。请确认脚本和 ${pluginName} 文件夹在同一个解压目录里。"
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

for version in 9 10 11 12; do
  defaults write "com.adobe.CSXS.$version" PlayerDebugMode 1
done

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$DEST_DIR" >/dev/null 2>&1 || true
fi

echo ""
echo "CEP 安装完成。"
echo "请重新打开 Photoshop，然后在 Window > Extensions 里查找 $PANEL_NAME。"
echo ""
read -r "?按回车关闭窗口..."
`;
}

function uninstallScript() {
  return `#!/bin/zsh
set -e

EXT_ID="${bundleId}"
DEST_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/$EXT_ID"

echo ""
echo "Removing CEP install:"
echo "$DEST_DIR"
echo ""

if [ -d "$DEST_DIR" ]; then
  rm -rf "$DEST_DIR"
  echo "已移除。"
else
  echo "没有找到安装目录。"
fi

echo ""
read -r "?按回车关闭窗口..."
`;
}

function checkScript() {
  return `#!/bin/zsh
set -e

EXT_ID="${bundleId}"
DEST_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/$EXT_ID"

echo ""
echo "检查 CEP 安装状态"
echo "$DEST_DIR"
echo ""

if [ -d "$DEST_DIR" ]; then
  echo "存在"
  ls -la "$DEST_DIR"
else
  echo "不存在"
fi

echo ""
for version in 9 10 11 12; do
  value="$(defaults read "com.adobe.CSXS.$version" PlayerDebugMode 2>/dev/null || true)"
  echo "com.adobe.CSXS.$version PlayerDebugMode=$value"
done

echo ""
read -r "?按回车关闭窗口..."
`;
}

function installText() {
  return `${panelName} 离线安装说明

这是 CEP 离线测试包，用来验证 Photoshop 2025 是否能加载本地复制的 CEP 面板。

安装：
1. 退出 Photoshop。
2. 双击 INSTALL_CEP_LOCAL.command。
3. 如果 macOS 阻止运行，右键脚本并选择打开。
4. 重新打开 Photoshop。
5. 在 Window > Extensions 里查找 ${panelName}。

检查：
双击 CHECK_CEP_INSTALL.command。

卸载：
双击 UNINSTALL_CEP_LOCAL.command。

说明：
安装脚本会开启 CEP debug mode，用于加载未签名本地扩展。
`;
}

try {
  const offlineStage = join(stagingDir, "offline");
  const offlinePluginDir = join(offlineStage, pluginName);

  await mkdir(offlineStage, { recursive: true });
  await cp(pluginDir, offlinePluginDir, {
    recursive: true,
    filter: (source) => !source.includes("/.DS_Store"),
  });

  await writeFile(join(offlineStage, "安装说明.txt"), installText(), "utf8");
  await writeFile(join(offlineStage, "INSTALL_CEP_LOCAL.command"), installScript(), "utf8");
  await writeFile(join(offlineStage, "UNINSTALL_CEP_LOCAL.command"), uninstallScript(), "utf8");
  await writeFile(join(offlineStage, "CHECK_CEP_INSTALL.command"), checkScript(), "utf8");

  await chmod(join(offlineStage, "INSTALL_CEP_LOCAL.command"), 0o755);
  await chmod(join(offlineStage, "UNINSTALL_CEP_LOCAL.command"), 0o755);
  await chmod(join(offlineStage, "CHECK_CEP_INSTALL.command"), 0o755);

  await archiveDirectory(offlineStage, offlinePath);
  console.log(`Created ${resolve(offlinePath)}`);
} finally {
  await rm(stagingDir, { recursive: true, force: true });
}

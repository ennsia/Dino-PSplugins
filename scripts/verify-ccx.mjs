import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";

const ccxPath = process.argv[2];

if (!ccxPath || !existsSync(ccxPath)) {
  console.error("Usage: node scripts/verify-ccx.mjs <path-to-ccx>");
  process.exit(1);
}

function runUnzip(args) {
  const result = spawnSync("unzip", args, { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(result.stderr || `unzip ${args.join(" ")} failed`);
  }

  return result.stdout;
}

const fileList = runUnzip(["-Z1", ccxPath])
  .split(/\r?\n/)
  .filter(Boolean);

if (!fileList.includes("manifest.json")) {
  throw new Error("CCX must contain manifest.json at the archive root.");
}

const manifest = JSON.parse(runUnzip(["-p", ccxPath, "manifest.json"]));

if (Array.isArray(manifest.host) || manifest.host?.app !== "PS") {
  throw new Error("Packaged Photoshop manifest.host must be a single PS object.");
}

if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error("Packaged manifest is missing top-level icons.");
}

for (const entrypoint of manifest.entrypoints || []) {
  if (entrypoint.type === "panel" && (!Array.isArray(entrypoint.icons) || entrypoint.icons.length === 0)) {
    throw new Error(`Panel entrypoint ${entrypoint.id} is missing icons.`);
  }
}

const iconPaths = [
  ...(manifest.icons || []).map((icon) => icon.path),
  ...(manifest.entrypoints || []).flatMap((entrypoint) =>
    (entrypoint.icons || []).map((icon) => icon.path)
  ),
];

for (const iconPath of iconPaths) {
  if (!fileList.includes(iconPath)) {
    throw new Error(`CCX is missing icon ${iconPath}.`);
  }

  const extension = iconPath.slice(iconPath.lastIndexOf("."));
  const retinaPath = iconPath.slice(0, -extension.length) + "@2x" + extension;
  if (!fileList.includes(retinaPath)) {
    throw new Error(`CCX is missing 2x icon ${retinaPath}.`);
  }
}

console.log(`${basename(ccxPath)}: Adobe-compatible CCX structure ok`);

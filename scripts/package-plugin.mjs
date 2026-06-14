import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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
const ccxPath = join(distDir, `${releaseName}.ccx`);
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

try {
  const ccxStage = join(stagingDir, "ccx");

  await mkdir(ccxStage, { recursive: true });
  await cp(pluginDir, ccxStage, {
    recursive: true,
    filter: (source) => !source.includes("/.DS_Store"),
  });

  await archiveDirectory(ccxStage, ccxPath);

  console.log(`Created ${resolve(ccxPath)}`);
} finally {
  await rm(stagingDir, { recursive: true, force: true });
}

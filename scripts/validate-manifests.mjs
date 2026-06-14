import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const pluginsDir = join(rootDir, "plugins");
const requiredFields = ["manifestVersion", "id", "name", "version", "main", "host"];
let failures = 0;

const pluginNames = await readdir(pluginsDir);

for (const pluginName of pluginNames) {
  const pluginDir = join(pluginsDir, pluginName);
  const manifestPath = join(pluginDir, "manifest.json");

  try {
    for (const fileName of ["README.md"]) {
      await access(join(pluginDir, fileName));
    }

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const missing = requiredFields.filter((field) => manifest[field] === undefined);

    if (missing.length > 0) {
      failures += 1;
      console.error(`${pluginName}: missing ${missing.join(", ")}`);
      continue;
    }

    if (!Array.isArray(manifest.host) || manifest.host.length === 0) {
      failures += 1;
      console.error(`${pluginName}: host must be a non-empty array`);
      continue;
    }

    await access(join(pluginDir, manifest.main));

    console.log(`${pluginName}: manifest ok`);
  } catch (error) {
    failures += 1;
    console.error(`${pluginName}: ${error.message}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}

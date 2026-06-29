import { readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir, tmpdir } from "node:os";

const watchDir = resolve(process.argv[2] || join(homedir(), "Downloads"));
const minutes = Number(process.argv[3] || 11);
const intervalMs = 30 * 1000;
const startedAt = Date.now();
const endsAt = startedAt + minutes * 60 * 1000;
const logPath = join(tmpdir(), "psdautosave-monitor.log");
const seen = new Set();
const lines = [];

function line(message) {
  const text = new Date().toISOString() + " " + message;
  lines.push(text);
  console.log(text);
}

async function snapshot() {
  let entries = [];
  try {
    entries = await readdir(watchDir);
  } catch (error) {
    line("[error] cannot read watch dir: " + error.message);
    return;
  }

  for (const name of entries) {
    if (!name.includes("__autosave__") || !/\.(psd|psb)$/i.test(name)) {
      continue;
    }

    const filePath = join(watchDir, name);
    let fileStat = null;
    try {
      fileStat = await stat(filePath);
    } catch (error) {
      line("[warn] cannot stat " + filePath + ": " + error.message);
      continue;
    }

    if (fileStat.mtimeMs < startedAt - 1000 || seen.has(filePath)) {
      continue;
    }

    seen.add(filePath);
    line("[backup] " + name + " size=" + fileStat.size + " mtime=" + fileStat.mtime.toISOString());
  }
}

line("[start] watching " + watchDir + " for " + minutes + " minutes");
await snapshot();

while (Date.now() < endsAt) {
  await new Promise((resolveTimer) => setTimeout(resolveTimer, intervalMs));
  await snapshot();
  await writeFile(logPath, lines.join("\n") + "\n", "utf8");
}

line("[done] found " + seen.size + " new backup file(s)");
await writeFile(logPath, lines.join("\n") + "\n", "utf8");
line("[log] " + logPath);

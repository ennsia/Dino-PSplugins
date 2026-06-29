const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const rootDir = path.dirname(__dirname);
const source = fs.readFileSync(
  path.join(rootDir, "plugins", "psdautosave", "src", "core.js"),
  "utf8"
);

const context = { console, globalThis: {} };
context.window = context.globalThis;
vm.createContext(context);
vm.runInContext(source, context);

const core = context.globalThis.PsdAutoSaveCore;

assert.equal(
  core.buildBackupFileName("角色立绘_女主.psd", new Date("2026-06-29T19:45:30")),
  "角色立绘_女主__autosave__20260629_194530.psd"
);

assert.equal(
  core.buildBackupFileName("scene.psb", new Date("2026-06-29T20:10:00")),
  "scene__autosave__20260629_201000.psb"
);

const split = core.splitFileName("file.name.psd");
assert.equal(split.stem, "file.name");
assert.equal(split.ext, "psd");

assert.equal(core.getActiveDocumentInfo(null).message, "没有打开文档");
assert.equal(core.getActiveDocumentInfo({ title: "Untitled-1" }).message, "请先保存为 PSD/PSB");
assert.equal(core.getActiveDocumentInfo({ title: "image.png", path: "/tmp/image.png" }).message, "当前仅支持 PSD/PSB");
assert.equal(core.getActiveDocumentInfo({ title: "image.psd", path: "/tmp/image.psd" }).ok, true);

const targetInfo = core.getActiveDocumentInfo({ id: 7, title: "main.psd", path: "/tmp/main.psd" });
const target = core.createDocumentTarget(targetInfo);
assert.equal(target.name, "main.psd");
assert.equal(core.documentMatchesTarget({ id: 7, title: "other.psd", path: "/tmp/other.psd" }, target), false);
assert.equal(core.documentMatchesTarget({ id: 8, title: "main.psd", path: "/tmp/main.psd" }, target), true);
assert.equal(core.documentMatchesTarget({ id: 9, title: "main.psd", path: "/tmp/not-main.psd" }, target), false);
assert.equal(core.documentMatchesTarget({ id: 7, title: "main.psd" }, { id: 7, name: "main.psd", path: "" }), true);

(async function testUniqueName() {
  const existing = new Set([
    "角色立绘_女主__autosave__20260629_194530.psd",
    "角色立绘_女主__autosave__20260629_194530_01.psd",
  ]);
  const folder = {
    async getEntry(name) {
      if (existing.has(name)) {
        return { name };
      }
      throw new Error("not found");
    },
  };

  const unique = await core.ensureUniqueBackupName(
    folder,
    "角色立绘_女主__autosave__20260629_194530",
    "psd"
  );
  assert.equal(unique, "角色立绘_女主__autosave__20260629_194530_02.psd");
  console.log("psdautosave core tests ok");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

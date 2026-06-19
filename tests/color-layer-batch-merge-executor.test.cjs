const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadScript(relativePath, context, moduleRef) {
  context.module = moduleRef;
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, relativePath), "utf8"),
    context,
    { filename: relativePath }
  );
}

const context = {
  Array,
  Boolean,
  Date,
  Map,
  Number,
  Set,
  String,
  console,
  globalThis: {},
};
const plannerModule = { exports: {} };
loadScript("../plugins/color-layer-batch-merge/src/planner.js", context, plannerModule);
context.globalThis.ColorMergePlanner = plannerModule.exports;
const executorModule = { exports: {} };
loadScript("../plugins/color-layer-batch-merge/src/executor.js", context, executorModule);

const { buildIndex } = plannerModule.exports;
const { executeMerge, findByLocator, findByPath } = executorModule.exports;
const pluginHtml = fs.readFileSync(
  path.join(__dirname, "../plugins/color-layer-batch-merge/index.html"),
  "utf8"
);
const pluginMain = fs.readFileSync(
  path.join(__dirname, "../plugins/color-layer-batch-merge/src/main.js"),
  "utf8"
);
const pluginManifest = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../plugins/color-layer-batch-merge/manifest.json"),
    "utf8"
  )
);
assert.match(pluginHtml, /id="executeApprove"/);
assert.match(pluginHtml, /id="executionApproval"/);
assert.match(pluginHtml, /批准并立即执行/);
assert.doesNotMatch(pluginHtml, /<dialog|method="dialog"/);
assert.doesNotMatch(pluginMain, /\.showModal\(/);
assert.doesNotMatch(pluginMain, /pendingDecision|showPanelDecision/);
assert.equal(pluginManifest.requiredPermissions.localFileSystem, "request");

function makeDocument() {
  let nextId = 100;
  const documentRef = {
    id: 2,
    title: "测试副本",
    layers: [],
  };

  function attach(layer, parentList) {
    layer._parentList = parentList;
    layer.delete = async function remove() {
      const index = layer._parentList.indexOf(layer);
      if (index >= 0) layer._parentList.splice(index, 1);
    };
    layer.duplicate = async function duplicate(target) {
      const copy = attach(
        {
          id: nextId++,
          name: layer.name,
          visible: layer.visible,
          grouped: layer.grouped,
        },
        target._parentList
      );
      target._parentList.splice(target._parentList.indexOf(target), 0, copy);
      return copy;
    };
    layer.merge = async function merge() {
      const index = layer._parentList.indexOf(layer);
      const below = layer._parentList[index + 1];
      layer._parentList.splice(index, 1);
      return below;
    };
    return layer;
  }

  const groupChildren = [];
  const group = {
    id: 9,
    name: "目标组",
    layers: groupChildren,
  };
  documentRef.layers.push(
    attach({ id: 1, name: "调色1", visible: true, grouped: true }, documentRef.layers),
    attach({ id: 2, name: "调色2", visible: true, grouped: true }, documentRef.layers),
    group
  );
  groupChildren.push(
    attach({ id: 3, name: "隐藏剪贴", visible: false, grouped: true }, groupChildren),
    attach({ id: 4, name: "可见剪贴", visible: true, grouped: true }, groupChildren),
    attach({ id: 5, name: "目标", visible: true }, groupChildren)
  );
  group._parentList = documentRef.layers;
  return documentRef;
}

const duplicateDocument = makeDocument();
assert.equal(findByPath(duplicateDocument, "目标组 / 目标").name, "目标");
assert.equal(findByLocator(duplicateDocument, [2, 2]).name, "目标");
assert.equal(buildIndex(duplicateDocument.layers).byId.size, 6);

const original = {
  id: 1,
  title: "测试.psd",
  duplicate: async function duplicate(name) {
    duplicateDocument.title = name;
    return duplicateDocument;
  },
};
let committed = false;
const photoshop = {
  constants: { ElementPlacement: { PLACEBEFORE: "before" } },
  action: { batchPlay: async () => [] },
  core: {
    executeAsModal: async (callback) =>
      callback({
        hostControl: {
          suspendHistory: async () => "history-token",
          resumeHistory: async (token, commit) => {
            assert.equal(token, "history-token");
            committed = commit;
          },
        },
      }),
  },
};
const logs = [];
const plan = {
  targetCount: 1,
  operations: [{ index: 1, target: "目标组 / 目标", targetLocator: [2, 2] }],
};
const sourceRecord = {
  layers: [
    { path: "调色1", locator: [0] },
    { path: "调色2", locator: [1] },
  ],
};

executeMerge({
  photoshop,
  document: original,
  plan,
  sourceRecord,
  unlockApproved: false,
  log: (message) => logs.push(message),
}).then((result) => {
  assert.equal(committed, true);
  assert.match(result.documentName, /^测试__调色批处理_\d{8}_\d{6}$/);
  assert.deepEqual(
    duplicateDocument.layers[2].layers.map((layer) => layer.name),
    ["目标"]
  );
  assert.equal(duplicateDocument.layers[0].visible, false);
  assert.equal(duplicateDocument.layers[1].visible, false);
  assert.ok(logs.some((line) => line.includes("删除隐藏剪贴层")));
  assert.ok(logs.some((line) => line.includes("隐藏原始调色层")));
  assert.ok(logs.some((line) => line.includes("[完成]")));
  console.log("Color Layer Batch Merge executor tests passed.");
});

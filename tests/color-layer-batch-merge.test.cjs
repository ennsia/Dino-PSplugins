const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const moduleRef = { exports: {} };
const source = fs.readFileSync(
  path.join(__dirname, "../plugins/color-layer-batch-merge/src/planner.js"),
  "utf8"
);
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
  module: moduleRef,
};
vm.runInNewContext(source, context, { filename: "planner.js" });

const { buildDryRun, createSelectionRecord, getLockReasons } = moduleRef.exports;

const color1 = { id: 1, name: "调色层1", grouped: true, visible: true };
const color2 = { id: 2, name: "调色层2", grouped: true, visible: true };
const oldClipTop = { id: 10, name: "旧调色1", grouped: true, visible: true };
const oldClipBottom = {
  id: 11,
  name: "旧调色2",
  grouped: true,
  visible: false,
  pixelsLocked: true,
};
const targetA = { id: 20, name: "图层A", visible: true };
const targetB = { id: 21, name: "图层B", visible: true, allLocked: true };
const targetC = { id: 22, name: "图层C", visible: true };
const nestedGroup = {
  id: 31,
  name: "内层组",
  layers: [oldClipTop, oldClipBottom, targetA, targetB, targetC],
};
const targetGroup = {
  id: 30,
  name: "目标组",
  layers: [nestedGroup],
};
const documentRef = {
  id: 99,
  title: "角色.psd",
  layers: [color1, color2, targetGroup],
  activeLayers: [color1, color2],
};

const sources = createSelectionRecord(
  documentRef,
  "sources",
  new Date("2026-06-19T00:00:00.000Z")
);
assert.deepEqual(
  JSON.parse(JSON.stringify(sources.layers.map((item) => item.id))),
  [1, 2]
);

documentRef.activeLayers = [targetGroup];
const targets = createSelectionRecord(documentRef, "targets");
const plan = buildDryRun(documentRef, sources, targets);

assert.deepEqual(JSON.parse(JSON.stringify(plan.errors)), []);
assert.equal(plan.targetCount, 3);
assert.equal(plan.operations[0].target, "目标组 / 内层组 / 图层A");
assert.deepEqual(
  JSON.parse(JSON.stringify(plan.operations[0].targetLocator)),
  [2, 0, 2]
);
assert.equal(plan.operations[0].clippingChainCount, 2);
assert.deepEqual(
  JSON.parse(JSON.stringify(plan.operations[0].clippingOperations.map((item) => item.type))),
  ["delete-hidden-clip", "merge-existing-clip-down"]
);
assert.deepEqual(
  JSON.parse(JSON.stringify(plan.operations[0].colorOperations.map((item) => item.layer))),
  ["调色层2", "调色层1"]
);
assert.equal(plan.totals.hiddenDeleteCount, 1);
assert.equal(plan.totals.mergeCount, 7);
assert.equal(plan.totals.lockCount, 2);
assert.deepEqual(getLockReasons(targetB), ["完全锁定"]);

console.log("Color Layer Batch Merge planner tests passed.");

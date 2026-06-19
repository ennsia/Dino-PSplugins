const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const moduleRef = { exports: {} };
const source = fs.readFileSync(
  path.join(__dirname, "../plugins/layer-quick-jump/src/layer-utils.js"),
  "utf8"
);
const context = {
  Array,
  Date,
  Number,
  String,
  console,
  globalThis: {},
  module: moduleRef,
};

vm.runInNewContext(source, context, { filename: "layer-utils.js" });

const {
  createLayerRecord,
  containsLayerId,
  findLayerById,
  findLayerObjectById,
  getDocumentId,
  sortLayersByDocumentOrder,
} = moduleRef.exports;

const nestedLayers = [
  {
    id: 10,
    name: "角色",
    layers: [
      {
        id: 20,
        name: "头部",
        layers: [{ id: 30, name: "眼睛" }],
      },
    ],
  },
  { id: 40, name: "背景" },
];

assert.deepEqual(JSON.parse(JSON.stringify(findLayerById(nestedLayers, 30))), {
  id: 30,
  name: "眼睛",
  path: "角色 / 头部 / 眼睛",
});
assert.equal(findLayerById(nestedLayers, 999), null);
assert.equal(findLayerObjectById(nestedLayers, 30).name, "眼睛");
assert.equal(containsLayerId(nestedLayers[0], 30), true);
assert.equal(containsLayerId(nestedLayers[1], 30), false);
assert.equal(getDocumentId({ id: 12 }), 12);
assert.equal(getDocumentId({}), null);
assert.deepEqual(
  sortLayersByDocumentOrder(nestedLayers, [nestedLayers[1], nestedLayers[0].layers[0]]).map(
    (layer) => layer.id
  ),
  [20, 40]
);

const record = createLayerRecord(
  {
    id: 7,
    title: "角色设计.psd",
    layers: nestedLayers,
    activeLayers: [{ id: 30, name: "眼睛" }],
  },
  new Date("2026-06-19T08:00:00.000Z")
);

assert.deepEqual(JSON.parse(JSON.stringify(record)), {
  id: 30,
  name: "眼睛",
  path: "角色 / 头部 / 眼睛",
  documentId: 7,
  documentName: "角色设计.psd",
  savedAt: "2026-06-19T08:00:00.000Z",
});

assert.equal(
  createLayerRecord({
    id: 7,
    title: "空文档.psd",
    layers: [],
    activeLayers: [],
  }),
  null
);

console.log("Layer Quick Jump logic tests passed.");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const pluginRoot = path.join(__dirname, "../plugins/layer-quick-jump");
const html = fs.readFileSync(path.join(pluginRoot, "index.html"), "utf8");
const utilsSource = fs.readFileSync(path.join(pluginRoot, "src/layer-utils.js"), "utf8");
const mainSource = fs.readFileSync(path.join(pluginRoot, "src/main.js"), "utf8");

assert.equal((html.match(/class="record"/g) || []).length, 3);
assert.equal((html.match(/class="action-button move-button"/g) || []).length, 3);
assert.equal((html.match(/class="clear-button"/g) || []).length, 3);
assert.equal(html.includes("recordPath"), false);
assert.ok(html.indexOf('id="pluginRoot"') < html.indexOf('src="src/main.js"'));
assert.ok(html.indexOf('src="src/main.js"') < html.indexOf("</body>"));

function createElement() {
  return {
    dataset: {},
    disabled: false,
    listeners: {},
    parentNode: null,
    textContent: "",
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

const elements = {};
for (let slot = 1; slot <= 3; slot += 1) {
  elements["recordName" + slot] = createElement();
  elements["save" + slot] = createElement();
  elements["jump" + slot] = createElement();
  elements["move" + slot] = createElement();
  elements["clear" + slot] = createElement();
}
elements.message = createElement();
elements.pluginRoot = createElement();
elements.pluginRoot.parentNode = {};

const moveCalls = [];
const anchorLayer = { id: 20, name: "眼睛", layers: [] };
const topSelectedLayer = {
  id: 30,
  name: "高光",
  layers: [],
  async move(anchor, placement) {
    moveCalls.push({ id: this.id, anchorId: anchor.id, placement });
  },
};
const bottomSelectedLayer = {
  id: 40,
  name: "阴影",
  layers: [],
  async move(anchor, placement) {
    moveCalls.push({ id: this.id, anchorId: anchor.id, placement });
  },
};

const activeDocument = {
  id: 88,
  title: "自动测试.psd",
  layers: [
    { id: 10, name: "角色", layers: [anchorLayer] },
    topSelectedLayer,
    bottomSelectedLayer,
  ],
  activeLayers: [anchorLayer],
};

const storage = new Map();
const selectedLayerIds = [];
const photoshop = {
  app: { activeDocument },
  constants: {
    ElementPlacement: {
      PLACEAFTER: "placeAfter",
    },
  },
  action: {
    async batchPlay(commands) {
      selectedLayerIds.push(commands[0]._target[0]._id);
    },
  },
  core: {
    async executeAsModal(callback) {
      await callback();
    },
  },
};

let panelEntrypoint = null;
const context = {
  Array,
  Date,
  JSON,
  Map,
  Number,
  Promise,
  String,
  console,
  document: {
    getElementById(id) {
      return elements[id] || null;
    },
  },
  localStorage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
  },
  module: { exports: {} },
  require(name) {
    if (name === "photoshop") {
      return photoshop;
    }

    if (name === "uxp") {
      return {
        entrypoints: {
          setup(configuration) {
            panelEntrypoint = configuration.panels.layerQuickJump;
          },
        },
      };
    }

    throw new Error("Unexpected module: " + name);
  },
  setImmediate,
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(utilsSource, context, { filename: "layer-utils.js" });
vm.runInNewContext(mainSource, context, { filename: "main.js" });

assert.ok(panelEntrypoint);

const panelNode = {
  appendChild(element) {
    element.parentNode = this;
  },
};
panelEntrypoint.show(panelNode);

assert.equal(elements.recordName1.textContent, "未保存");
assert.equal(elements.jump1.disabled, true);
assert.equal(elements.move1.disabled, true);
assert.equal(elements.clear1.disabled, true);
assert.match(elements.message.textContent, /保存锚点/);

(async () => {
  elements.save1.listeners.click();
  await flushAsyncWork();

  assert.equal(elements.recordName1.textContent, "眼睛");
  assert.equal(elements.jump1.disabled, false);
  assert.equal(elements.move1.disabled, false);
  assert.equal(elements.clear1.disabled, false);
  assert.match(elements.message.textContent, /记录 1 已保存/);

  elements.jump1.listeners.click();
  await flushAsyncWork();

  assert.deepEqual(selectedLayerIds, [20]);
  assert.match(elements.message.textContent, /已跳转到记录 1/);

  activeDocument.activeLayers = [bottomSelectedLayer, topSelectedLayer];
  elements.move1.listeners.click();
  await flushAsyncWork();

  assert.deepEqual(moveCalls, [
    { id: 40, anchorId: 20, placement: "placeAfter" },
    { id: 30, anchorId: 20, placement: "placeAfter" },
  ]);
  assert.match(elements.message.textContent, /已将 2 个图层转移/);

  activeDocument.activeLayers = [anchorLayer];
  elements.move1.listeners.click();
  await flushAsyncWork();
  assert.match(elements.message.textContent, /不能转移锚点本身/);
  assert.equal(moveCalls.length, 2);

  elements.clear1.listeners.click();
  assert.equal(elements.recordName1.textContent, "未保存");
  assert.equal(elements.jump1.disabled, true);
  assert.equal(elements.move1.disabled, true);
  assert.equal(elements.clear1.disabled, true);
  assert.match(elements.message.textContent, /记录 1 已清除/);

  console.log("Layer Quick Jump UI tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

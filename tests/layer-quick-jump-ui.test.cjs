const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const pluginRoot = path.join(__dirname, "../plugins/layer-quick-jump");
const html = fs.readFileSync(path.join(pluginRoot, "index.html"), "utf8");
const utilsSource = fs.readFileSync(path.join(pluginRoot, "src/layer-utils.js"), "utf8");
const mainSource = fs.readFileSync(path.join(pluginRoot, "src/main.js"), "utf8");

assert.equal((html.match(/class="record"/g) || []).length, 3);
assert.ok(html.indexOf("<main") < html.indexOf('src="src/main.js"'));
assert.ok(html.indexOf('src="src/main.js"') < html.indexOf("</body>"));

function createElement() {
  return {
    dataset: {},
    disabled: false,
    listeners: {},
    textContent: "",
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
  };
}

const elements = {};
for (let slot = 1; slot <= 3; slot += 1) {
  elements["recordName" + slot] = createElement();
  elements["recordPath" + slot] = createElement();
  elements["save" + slot] = createElement();
  elements["jump" + slot] = createElement();
}
elements.message = createElement();
elements.pluginRoot = createElement();
elements.pluginRoot.parentNode = {};

const storage = new Map();
const selectedLayerIds = [];
const activeDocument = {
  id: 88,
  title: "自动测试.psd",
  layers: [
    {
      id: 10,
      name: "角色",
      layers: [{ id: 20, name: "眼睛" }],
    },
  ],
  activeLayers: [{ id: 20, name: "眼睛" }],
};

const photoshop = {
  app: { activeDocument },
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
  String,
  console,
  document: {
    readyState: "complete",
    addEventListener() {},
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
assert.equal(elements.message.textContent, "选择图层或图层组，然后保存到任意记录位。");

elements.save1.listeners.click();

setImmediate(async () => {
  assert.equal(elements.recordName1.textContent, "眼睛");
  assert.equal(elements.recordPath1.textContent, "自动测试.psd · 角色 / 眼睛");
  assert.equal(elements.jump1.disabled, false);
  assert.match(elements.message.textContent, /记录 1 已保存/);

  elements.jump1.listeners.click();

  setImmediate(() => {
    assert.deepEqual(selectedLayerIds, [20]);
    assert.match(elements.message.textContent, /已跳转到记录 1/);
    console.log("Layer Quick Jump UI tests passed.");
  });
});

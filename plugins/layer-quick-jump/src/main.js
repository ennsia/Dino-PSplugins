const photoshop = require("photoshop");
const { action, app, core } = photoshop;

const STORAGE_KEY = "layerQuickJump.records.v1";
const SLOT_COUNT = 3;
let records = loadRecords();

function getActiveDocument() {
  return app.activeDocument || null;
}

function setMessage(text, tone = "info") {
  const message = document.getElementById("message");
  message.textContent = text;
  message.dataset.tone = tone;
}

function loadRecords() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.from({ length: SLOT_COUNT }, (_, index) => stored[index] || null);
  } catch (error) {
    return Array.from({ length: SLOT_COUNT }, () => null);
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getDocumentLabel(documentRef) {
  return documentRef?.title || "Untitled";
}

function getDocumentId(documentRef) {
  return documentRef?.id === undefined ? null : documentRef.id;
}

function getLayerChildren(layer) {
  if (!layer || !layer.layers) {
    return [];
  }

  try {
    return Array.from(layer.layers);
  } catch (error) {
    return [];
  }
}

function findLayerById(layers, targetId, parentNames = []) {
  for (const layer of Array.from(layers || [])) {
    const layerId = Number(layer.id);
    const name = layer.name || "未命名图层";
    const pathParts = [...parentNames, name];

    if (layerId === Number(targetId)) {
      return {
        id: layerId,
        name,
        path: pathParts.join(" / "),
      };
    }

    const found = findLayerById(getLayerChildren(layer), targetId, pathParts);
    if (found) {
      return found;
    }
  }

  return null;
}

function getActiveLayerRecord(documentRef) {
  const activeLayers = Array.from(documentRef?.activeLayers || []);
  const activeLayer = activeLayers[0];

  if (!activeLayer) {
    return null;
  }

  const found = findLayerById(documentRef.layers, activeLayer.id);

  return {
    id: Number(activeLayer.id),
    name: activeLayer.name || found?.name || "未命名图层",
    path: found?.path || activeLayer.name || "未命名图层",
    documentId: getDocumentId(documentRef),
    documentName: getDocumentLabel(documentRef),
    savedAt: new Date().toISOString(),
  };
}

function renderRecords() {
  records.forEach((record, index) => {
    const slot = index + 1;
    const nameEl = document.getElementById(`recordName${slot}`);
    const pathEl = document.getElementById(`recordPath${slot}`);
    const jumpButton = document.getElementById(`jump${slot}`);

    if (!record) {
      nameEl.textContent = "未保存";
      pathEl.textContent = "选择一个图层或图层组后保存";
      jumpButton.disabled = true;
      return;
    }

    nameEl.textContent = record.name;
    pathEl.textContent = `${record.documentName} · ${record.path}`;
    jumpButton.disabled = false;
  });
}

async function saveSlot(slot) {
  const activeDocument = getActiveDocument();

  if (!activeDocument) {
    setMessage("请先打开一个 Photoshop 文档。", "warn");
    return;
  }

  const record = getActiveLayerRecord(activeDocument);

  if (!record) {
    setMessage("没有找到当前选中的图层或图层组。", "warn");
    return;
  }

  records[slot - 1] = record;
  saveRecords();
  renderRecords();
  setMessage(`记录 ${slot} 已保存：${record.name}`, "success");
}

async function jumpToSlot(slot) {
  const record = records[slot - 1];
  const activeDocument = getActiveDocument();

  if (!record) {
    setMessage(`记录 ${slot} 还没有保存。`, "warn");
    return;
  }

  if (!activeDocument) {
    setMessage("请先打开包含该记录点的 Photoshop 文档。", "warn");
    return;
  }

  const activeDocumentId = getDocumentId(activeDocument);
  if (record.documentId !== null && activeDocumentId !== null && record.documentId !== activeDocumentId) {
    setMessage(`当前文档不是记录 ${slot} 所在文档：${record.documentName}`, "warn");
    return;
  }

  const layer = findLayerById(activeDocument.layers, record.id);

  if (!layer) {
    setMessage(`记录 ${slot} 对应的图层可能已被删除或移动到其他文档。`, "warn");
    return;
  }

  await core.executeAsModal(
    async () => {
      await action.batchPlay(
        [
          {
            _obj: "select",
            _target: [{ _ref: "layer", _id: record.id }],
            makeVisible: false,
            _options: { dialogOptions: "dontDisplay" },
          },
        ],
        {}
      );
    },
    { commandName: `跳转到记录 ${slot}` }
  );

  setMessage(`已跳转到记录 ${slot}：${layer.name}`, "success");
}

document.addEventListener("DOMContentLoaded", () => {
  for (let slot = 1; slot <= SLOT_COUNT; slot += 1) {
    document.getElementById(`save${slot}`).addEventListener("click", () => saveSlot(slot));
    document.getElementById(`jump${slot}`).addEventListener("click", () => jumpToSlot(slot));
  }

  renderRecords();
});

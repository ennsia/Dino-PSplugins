const STORAGE_KEY = "layerQuickJumpCep.records.v1";
const SLOT_COUNT = 3;

let records = loadRecords();

function setMessage(text, tone) {
  const message = document.getElementById("message");
  message.textContent = text;
  message.dataset.tone = tone || "info";
}

function evalScript(script) {
  return new Promise((resolve, reject) => {
    if (!window.__adobe_cep__) {
      reject(new Error("CEP runtime not available."));
      return;
    }

    window.__adobe_cep__.evalScript(script, (result) => {
      resolve(result);
    });
  });
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

function renderRecords() {
  records.forEach((record, index) => {
    const slot = index + 1;
    const name = document.getElementById(`recordName${slot}`);
    const jump = document.getElementById(`jump${slot}`);

    if (!record) {
      name.textContent = "未保存";
      jump.disabled = true;
      return;
    }

    name.textContent = `${record.name} · ${record.documentName}`;
    jump.disabled = false;
  });
}

async function saveSlot(slot) {
  try {
    const raw = await evalScript("LayerQuickJump.getActiveLayerRecord()");
    const record = JSON.parse(raw);

    if (record.error) {
      setMessage(record.error, "warn");
      return;
    }

    records[slot - 1] = record;
    saveRecords();
    renderRecords();
    setMessage(`记录 ${slot} 已保存：${record.name}`, "success");
  } catch (error) {
    setMessage(`保存失败：${error.message}`, "warn");
  }
}

async function jumpToSlot(slot) {
  const record = records[slot - 1];

  if (!record) {
    setMessage(`记录 ${slot} 还没有保存。`, "warn");
    return;
  }

  try {
    const raw = await evalScript(`LayerQuickJump.selectLayerById(${Number(record.id)})`);
    const result = JSON.parse(raw);

    if (result.error) {
      setMessage(result.error, "warn");
      return;
    }

    setMessage(`已跳转到记录 ${slot}：${record.name}`, "success");
  } catch (error) {
    setMessage(`跳转失败：${error.message}`, "warn");
  }
}

function loadHostScript() {
  const extensionRoot = window.__adobe_cep__.getSystemPath("extension").replace(/\\/g, "/");
  const hostScript = `${extensionRoot}/jsx/host.jsx`;
  return evalScript(`$.evalFile("${hostScript}")`);
}

document.addEventListener("DOMContentLoaded", async () => {
  for (let slot = 1; slot <= SLOT_COUNT; slot += 1) {
    document.getElementById(`save${slot}`).addEventListener("click", () => saveSlot(slot));
    document.getElementById(`jump${slot}`).addEventListener("click", () => jumpToSlot(slot));
  }

  renderRecords();

  try {
    await loadHostScript();
    setMessage("CEP 面板已加载。选中图层后保存记录点。", "success");
  } catch (error) {
    setMessage(`Host 脚本加载失败：${error.message}`, "warn");
  }
});

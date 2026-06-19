(function startLayerQuickJump() {
  const STORAGE_KEY = "layerQuickJump.records.v1";
  const SLOT_COUNT = 3;
  let records = createEmptyRecords();
  let photoshopApi = null;
  let initialized = false;

  function createEmptyRecords() {
    return Array.from({ length: SLOT_COUNT }, function createEmptySlot() {
      return null;
    });
  }

  function setMessage(text, tone) {
    const message = document.getElementById("message");
    if (!message) {
      return;
    }

    message.textContent = text;
    message.dataset.tone = tone || "info";
  }

  function reportError(prefix, error) {
    const detail = error && error.message ? error.message : String(error);
    setMessage(prefix + "：" + detail, "error");
    console.error("[Layer Quick Jump]", prefix, error);
  }

  function loadRecords() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.from({ length: SLOT_COUNT }, function restoreSlot(_, index) {
        return stored[index] || null;
      });
    } catch (error) {
      console.warn("[Layer Quick Jump] 无法读取本地记录，将使用空记录。", error);
      return createEmptyRecords();
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (error) {
      reportError("保存记录失败", error);
      return false;
    }
  }

  function getActiveDocument() {
    return photoshopApi && photoshopApi.app ? photoshopApi.app.activeDocument || null : null;
  }

  function renderRecords() {
    records.forEach(function renderRecord(record, index) {
      const slot = index + 1;
      const nameEl = document.getElementById("recordName" + slot);
      const jumpButton = document.getElementById("jump" + slot);
      const moveButton = document.getElementById("move" + slot);
      const clearButton = document.getElementById("clear" + slot);

      if (!nameEl || !jumpButton || !moveButton || !clearButton) {
        return;
      }

      if (!record) {
        nameEl.textContent = "未保存";
        jumpButton.disabled = true;
        moveButton.disabled = true;
        clearButton.disabled = true;
        return;
      }

      nameEl.textContent = record.name;
      jumpButton.disabled = false;
      moveButton.disabled = false;
      clearButton.disabled = false;
    });
  }

  function getSlotContext(slot) {
    const record = records[slot - 1];
    const activeDocument = getActiveDocument();

    if (!record) {
      setMessage("记录 " + slot + " 还没有保存。", "warn");
      return null;
    }

    if (!activeDocument) {
      setMessage("请先打开包含该记录点的 Photoshop 文档。", "warn");
      return null;
    }

    const activeDocumentId = window.LayerQuickJumpUtils.getDocumentId(activeDocument);
    if (
      record.documentId !== null &&
      activeDocumentId !== null &&
      record.documentId !== activeDocumentId
    ) {
      setMessage("当前文档不是记录 " + slot + " 所在文档：" + record.documentName, "warn");
      return null;
    }

    const anchorLayer = window.LayerQuickJumpUtils.findLayerObjectById(
      activeDocument.layers,
      record.id
    );
    if (!anchorLayer) {
      setMessage("记录 " + slot + " 对应的图层可能已被删除。", "warn");
      return null;
    }

    return { record, activeDocument, anchorLayer };
  }

  async function saveSlot(slot) {
    try {
      const activeDocument = getActiveDocument();

      if (!activeDocument) {
        setMessage("请先打开一个 Photoshop 文档。", "warn");
        return;
      }

      const record = window.LayerQuickJumpUtils.createLayerRecord(activeDocument);

      if (!record) {
        setMessage("没有找到当前选中的图层或图层组。", "warn");
        return;
      }

      records[slot - 1] = record;
      if (!saveRecords()) {
        return;
      }

      renderRecords();
      setMessage("记录 " + slot + " 已保存：" + record.name, "success");
    } catch (error) {
      reportError("保存记录失败", error);
    }
  }

  async function jumpToSlot(slot) {
    try {
      const context = getSlotContext(slot);
      if (!context) {
        return;
      }

      const { record, anchorLayer } = context;

      await photoshopApi.core.executeAsModal(
        async function selectSavedLayer() {
          await photoshopApi.action.batchPlay(
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
        { commandName: "跳转到记录 " + slot }
      );

      setMessage("已跳转到记录 " + slot + "：" + anchorLayer.name, "success");
    } catch (error) {
      reportError("跳转失败", error);
    }
  }

  async function moveSelectionToSlot(slot) {
    try {
      const context = getSlotContext(slot);
      if (!context) {
        return;
      }

      const { activeDocument, anchorLayer } = context;
      const selectedLayers = window.LayerQuickJumpUtils.sortLayersByDocumentOrder(
        activeDocument.layers,
        activeDocument.activeLayers || []
      );

      if (selectedLayers.length === 0) {
        setMessage("请先选择需要转移的图层或图层组。", "warn");
        return;
      }

      const selectionContainsAnchor = selectedLayers.some(function isAnchorOrParent(layer) {
        return (
          Number(layer.id) === Number(anchorLayer.id) ||
          window.LayerQuickJumpUtils.containsLayerId(layer, anchorLayer.id)
        );
      });

      if (selectionContainsAnchor) {
        setMessage("不能转移锚点本身或包含锚点的图层组。", "warn");
        return;
      }

      const placement =
        photoshopApi.constants &&
        photoshopApi.constants.ElementPlacement &&
        photoshopApi.constants.ElementPlacement.PLACEAFTER;

      if (!placement) {
        throw new Error("当前 Photoshop 版本不支持图层转移位置");
      }

      await photoshopApi.core.executeAsModal(
        async function moveSelectedLayers() {
          for (let index = selectedLayers.length - 1; index >= 0; index -= 1) {
            await selectedLayers[index].move(anchorLayer, placement);
          }
        },
        { commandName: "转移图层到记录 " + slot }
      );

      setMessage(
        "已将 " + selectedLayers.length + " 个图层转移到“" + anchorLayer.name + "”下方。",
        "success"
      );
    } catch (error) {
      reportError("转移失败", error);
    }
  }

  function clearSlot(slot) {
    if (!records[slot - 1]) {
      return;
    }

    records[slot - 1] = null;
    if (!saveRecords()) {
      return;
    }

    renderRecords();
    setMessage("记录 " + slot + " 已清除。", "success");
  }

  function bindButtons() {
    for (let slot = 1; slot <= SLOT_COUNT; slot += 1) {
      const saveButton = document.getElementById("save" + slot);
      const jumpButton = document.getElementById("jump" + slot);
      const moveButton = document.getElementById("move" + slot);
      const clearButton = document.getElementById("clear" + slot);

      if (!saveButton || !jumpButton || !moveButton || !clearButton) {
        throw new Error("找不到记录 " + slot + " 的按钮");
      }

      saveButton.addEventListener("click", function handleSave() {
        saveSlot(slot);
      });
      jumpButton.addEventListener("click", function handleJump() {
        jumpToSlot(slot);
      });
      moveButton.addEventListener("click", function handleMove() {
        moveSelectionToSlot(slot);
      });
      clearButton.addEventListener("click", function handleClear() {
        clearSlot(slot);
      });
    }
  }

  function initialize() {
    if (initialized) {
      renderRecords();
      return;
    }

    try {
      renderRecords();

      if (!window.LayerQuickJumpUtils) {
        throw new Error("图层工具模块加载失败");
      }

      photoshopApi = require("photoshop");
      records = loadRecords();
      bindButtons();
      renderRecords();
      initialized = true;
      setMessage("保存锚点后，可跳转或把当前所选图层转移到锚点下方。", "info");
      console.log("[Layer Quick Jump] 初始化完成");
    } catch (error) {
      reportError("插件初始化失败", error);
    }
  }

  function showPanel(rootNode) {
    try {
      const panelNode = rootNode && rootNode.node ? rootNode.node : rootNode;
      const pluginRoot = document.getElementById("pluginRoot");

      if (!pluginRoot) {
        throw new Error("找不到插件界面根节点");
      }

      if (panelNode && pluginRoot.parentNode !== panelNode) {
        panelNode.appendChild(pluginRoot);
      }

      initialize();
    } catch (error) {
      reportError("显示面板失败", error);
    }
  }

  try {
    const uxp = require("uxp");
    uxp.entrypoints.setup({
      panels: {
        layerQuickJump: {
          create: function createPanel() {},
          show: showPanel,
          hide: function hidePanel() {},
          destroy: function destroyPanel() {},
        },
      },
    });
    console.log("[Layer Quick Jump] 面板入口已注册");
  } catch (error) {
    reportError("注册面板入口失败", error);
  }
})();

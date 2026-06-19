(function startColorLayerBatchMerge() {
  const STORAGE_KEY = "colorLayerBatchMerge.anchors.v1";
  let photoshopApi = null;
  let uxpApi = null;
  let initialized = false;
  let anchors = { sources: null, targets: null };
  let logLines = [];
  let logFileEntry = null;
  let logWriteChain = Promise.resolve();
  let pendingExecution = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function getActiveDocument() {
    return photoshopApi && photoshopApi.app ? photoshopApi.app.activeDocument || null : null;
  }

  function setMessage(text, tone) {
    const element = byId("message");
    if (!element) {
      return;
    }
    element.textContent = text;
    element.dataset.tone = tone || "info";
  }

  function appendLog(text, tone) {
    const output = byId("logOutput");
    if (!output) {
      return;
    }
    const line = document.createElement("div");
    line.className = "log-line";
    line.dataset.tone = tone || "info";
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
    const now = new Date().toISOString();
    logLines.push(now + " " + text);
    persistLog();
  }

  function clearLog() {
    const output = byId("logOutput");
    if (output) {
      output.innerHTML = "";
    }
    logLines = [];
    persistLog();
  }

  function logText() {
    return (
      "调色图层批量合并诊断日志\n" +
      "版本：0.3.0\n" +
      "生成时间：" +
      new Date().toISOString() +
      "\n\n" +
      logLines.join("\n") +
      "\n"
    );
  }

  function persistLog() {
    if (!logFileEntry) {
      return;
    }
    const snapshot = logText();
    logWriteChain = logWriteChain
      .catch(function ignorePreviousWriteError() {})
      .then(function writeLatestLog() {
        return logFileEntry.write(snapshot);
      })
      .catch(function reportWriteError(error) {
        console.error("[调色图层批量合并] 自动日志写入失败", error);
      });
  }

  async function initializeLogFile() {
    try {
      const folder = await uxpApi.storage.localFileSystem.getDataFolder();
      logFileEntry = await folder.createFile("color-layer-batch-merge-latest.log", {
        overwrite: true,
      });
      persistLog();
    } catch (error) {
      console.error("[调色图层批量合并] 无法创建自动日志", error);
    }
  }

  async function exportLog() {
    try {
      const file = await uxpApi.storage.localFileSystem.getFileForSaving(
        "color-layer-batch-merge-" + new Date().toISOString().replace(/[:.]/g, "-") + ".txt",
        { types: ["txt"] }
      );
      if (!file) {
        return;
      }
      await file.write(logText());
      appendLog("[日志] 已导出诊断日志：" + file.name, "success");
      setMessage("日志已导出。", "success");
    } catch (error) {
      reportError("导出日志失败", error);
      if (logFileEntry && logFileEntry.nativePath) {
        appendLog("[日志兜底] 自动日志位置：" + logFileEntry.nativePath, "warn");
      }
    }
  }

  function reportError(prefix, error) {
    const detail = error && error.message ? error.message : String(error);
    appendLog("[错误] " + prefix + "：" + detail, "error");
    setMessage(prefix + "：" + detail, "error");
    console.error("[调色图层批量合并]", prefix, error);
  }

  function loadAnchors() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return stored && typeof stored === "object" ? stored : { sources: null, targets: null };
    } catch (error) {
      return { sources: null, targets: null };
    }
  }

  function saveAnchors() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(anchors));
  }

  function invalidatePendingExecution() {
    pendingExecution = null;
    const approval = byId("executionApproval");
    if (approval) {
      approval.classList.add("hidden");
    }
  }

  function renderAnchor(role, summaryId, listId) {
    const record = anchors[role];
    const summary = byId(summaryId);
    const list = byId(listId);
    list.innerHTML = "";

    if (!record || !record.layers || record.layers.length === 0) {
      summary.textContent = "尚未记录";
      return;
    }

    summary.textContent =
      record.layers.length + " 项 · " + record.documentName;
    record.layers.forEach(function renderLayer(layer) {
      const item = document.createElement("div");
      item.className = "layer-item";
      item.textContent = (layer.isGroup ? "▣ " : "▤ ") + layer.path;
      list.appendChild(item);
    });
  }

  function render() {
    renderAnchor("sources", "sourceSummary", "sourceList");
    renderAnchor("targets", "targetSummary", "targetList");
    const missingAnchor = !(anchors.sources && anchors.targets);
    byId("runDryRun").disabled = missingAnchor;
    byId("executeMerge").disabled = missingAnchor;
  }

  function remember(role) {
    try {
      const activeDocument = getActiveDocument();
      if (!activeDocument) {
        setMessage("请先打开一个 Photoshop 文档。", "warn");
        return;
      }

      const record = window.ColorMergePlanner.createSelectionRecord(activeDocument, role);
      if (!record) {
        setMessage("请先在图层面板选择一个或多个图层。", "warn");
        return;
      }

      anchors[role] = record;
      invalidatePendingExecution();
      saveAnchors();
      render();
      appendLog(
        "[记录] " + (role === "sources" ? "调色层" : "目标层") + "：" +
          record.layers.map(function name(item) { return item.path; }).join("、"),
        "success"
      );
      setMessage("锚点已记录。可先 Dry Run，再在安全副本中实际执行。", "success");
    } catch (error) {
      reportError("记录锚点失败", error);
    }
  }

  function clearAnchors() {
    anchors = { sources: null, targets: null };
    invalidatePendingExecution();
    saveAnchors();
    render();
    appendLog("[记录] 已清除两个锚点。", "info");
    setMessage("请重新记录调色层和目标层。", "info");
  }

  function writePlan(plan, unlockApproved, executionMode) {
    appendLog("[检查] 文档：" + plan.documentName);
    appendLog("[检查] 调色源：" + plan.sourceCount + " 层");
    appendLog("[检查] 目标：" + plan.targetCount + " 层");
    appendLog("[计划] 正式执行前将创建完整文档副本", "success");
    appendLog("[计划] 合并完成后将在副本中隐藏原始调色源层");

    plan.warnings.forEach(function writeWarning(message) {
      appendLog("[警告] " + message, "warn");
    });

    plan.operations.forEach(function writeTarget(operation) {
      appendLog("");
      appendLog("[目标 " + operation.index + "/" + plan.targetCount + "] " + operation.target);
      if (operation.clippingChainCount === 0) {
        appendLog("  无原有剪贴蒙版");
      } else {
        appendLog("  发现原有剪贴蒙版：" + operation.clippingChainCount + " 层");
      }

      operation.clippingOperations.forEach(function writeClip(item) {
        if (item.type === "delete-hidden-clip") {
          appendLog("  将丢弃隐藏剪贴层：" + item.layer, "warn");
        } else {
          appendLog("  将向下合并原剪贴层：" + item.layer);
        }
      });
      operation.colorOperations.forEach(function writeColor(item) {
        appendLog("  将复制并向下合并调色层：" + item.layer);
      });
    });

    if (plan.locks.length > 0) {
      appendLog("");
      appendLog(
        unlockApproved
          ? "[审批] 已批准在副本文档中自动解锁 " + plan.locks.length + " 层"
          : "[检查] 检测到锁定层 " + plan.locks.length + " 个；实际执行时将在确认卡中审批",
        unlockApproved ? "success" : "warn"
      );
    }

    appendLog("");
    appendLog("[统计] 将丢弃隐藏剪贴层：" + plan.totals.hiddenDeleteCount);
    appendLog("[统计] 预计逐层向下合并：" + plan.totals.mergeCount + " 次");
    appendLog(
      executionMode
        ? "[检查] 计划核对完成；尚未修改文档"
        : "[结果] Dry Run 完成；当前文档没有发生修改",
      "success"
    );
  }

  async function runDryRun() {
    try {
      clearLog();
      const plan = window.ColorMergePlanner.buildDryRun(
        getActiveDocument(),
        anchors.sources,
        anchors.targets
      );

      if (plan.errors.length > 0) {
        plan.errors.forEach(function writeError(message) {
          appendLog("[阻止] " + message, "error");
        });
        setMessage("Dry Run 未通过，请查看日志。", "error");
        return;
      }

      writePlan(plan, false, false);
      setMessage("Dry Run 通过。请核对日志中的图层顺序。", "success");
    } catch (error) {
      reportError("生成 Dry Run 失败", error);
    }
  }

  function showExecutionApproval(plan, activeDocument) {
    byId("executeTargetCount").textContent = "目标：" + plan.targetCount + " 层";
    byId("executeMergeCount").textContent = "预计合并：" + plan.totals.mergeCount + " 次";
    byId("executeLockCount").textContent = "需要自动解锁：" + plan.locks.length + " 层";

    const lockSection = byId("approvalLockSection");
    const lockList = byId("approvalLockList");
    lockList.innerHTML = "";
    if (plan.locks.length > 0) {
      plan.locks.forEach(function renderApprovalLock(lock) {
        const item = document.createElement("div");
        item.className = "unlock-item";
        item.textContent = lock.path + " — " + lock.reasons.join("、");
        lockList.appendChild(item);
      });
      lockSection.classList.remove("hidden");
    } else {
      lockSection.classList.add("hidden");
    }

    pendingExecution = { plan, activeDocument };
    byId("executionApproval").classList.remove("hidden");
    appendLog("[审批] 面板内确认卡已展开，等待用户点击“批准并立即执行”。", "warn");
    setMessage("请在实际合并按钮下方确认执行。", "warn");
  }

  function cancelPendingExecution() {
    if (!pendingExecution) {
      return;
    }
    pendingExecution = null;
    byId("executionApproval").classList.add("hidden");
    appendLog("[取消] 用户取消实际合并；文档没有发生修改。", "warn");
    setMessage("已取消实际合并。", "warn");
  }

  function setBusy(busy) {
    byId("saveSources").disabled = busy;
    byId("saveTargets").disabled = busy;
    byId("clearAnchors").disabled = busy;
    byId("runDryRun").disabled = busy || !(anchors.sources && anchors.targets);
    byId("executeMerge").disabled = busy || !(anchors.sources && anchors.targets);
  }

  function prepareMerge() {
    try {
      clearLog();
      const activeDocument = getActiveDocument();
      const plan = window.ColorMergePlanner.buildDryRun(
        activeDocument,
        anchors.sources,
        anchors.targets
      );

      if (plan.errors.length > 0) {
        plan.errors.forEach(function writeError(message) {
          appendLog("[阻止] " + message, "error");
        });
        setMessage("执行前检查未通过，请查看日志。", "error");
        return;
      }

      writePlan(plan, false, true);
      showExecutionApproval(plan, activeDocument);
    } catch (error) {
      reportError("准备实际合并失败", error);
    }
  }

  async function approvePendingExecution() {
    if (!pendingExecution) {
      appendLog("[审批异常] 没有待执行的计划，请重新点击实际合并。", "error");
      setMessage("执行计划已失效，请重新点击实际合并。", "error");
      return;
    }

    const current = pendingExecution;
    pendingExecution = null;
    byId("executionApproval").classList.add("hidden");
    appendLog("[审批] 用户已批准实际执行。", "success");

    try {
      if (
        !getActiveDocument() ||
        Number(getActiveDocument().id) !== Number(current.plan.documentId)
      ) {
        throw new Error("确认期间活动文档已改变，请重新记录或重新执行");
      }
      setBusy(true);
      setMessage("正在创建安全副本并执行，请勿切换文档……", "warn");
      const result = await window.ColorMergeExecutor.executeMerge({
        photoshop: photoshopApi,
        document: current.activeDocument,
        plan: current.plan,
        sourceRecord: anchors.sources,
        unlockApproved: current.plan.locks.length > 0,
        log: appendLog,
      });
      setMessage("实际合并完成：" + result.documentName, "success");
    } catch (error) {
      reportError("实际合并失败", error);
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    byId("saveSources").addEventListener("click", function saveSources() {
      remember("sources");
    });
    byId("saveTargets").addEventListener("click", function saveTargets() {
      remember("targets");
    });
    byId("clearAnchors").addEventListener("click", clearAnchors);
    byId("clearLog").addEventListener("click", clearLog);
    byId("exportLog").addEventListener("click", exportLog);
    byId("runDryRun").addEventListener("click", runDryRun);
    byId("executeMerge").addEventListener("click", prepareMerge);
    byId("executeCancel").addEventListener("click", cancelPendingExecution);
    byId("executeApprove").addEventListener("click", approvePendingExecution);
  }

  function initialize() {
    if (initialized) {
      render();
      return;
    }

    try {
      if (!window.ColorMergePlanner || !window.ColorMergeExecutor) {
        throw new Error("规划或执行模块加载失败");
      }
      photoshopApi = require("photoshop");
      uxpApi = require("uxp");
      anchors = loadAnchors();
      bindEvents();
      render();
      initialized = true;
      initializeLogFile();
      appendLog("[就绪] 安全副本执行版已加载。");
      setMessage("记录两个锚点后，可生成计划或在副本中实际合并。", "info");
    } catch (error) {
      reportError("插件初始化失败", error);
    }
  }

  function showPanel(rootNode) {
    const panelNode = rootNode && rootNode.node ? rootNode.node : rootNode;
    const pluginRoot = byId("pluginRoot");
    if (panelNode && pluginRoot && pluginRoot.parentNode !== panelNode) {
      panelNode.appendChild(pluginRoot);
    }
    initialize();
  }

  try {
    const uxp = require("uxp");
    uxp.entrypoints.setup({
      panels: {
        colorLayerBatchMerge: {
          create: function createPanel() {},
          show: showPanel,
          hide: function hidePanel() {},
          destroy: function destroyPanel() {},
        },
      },
    });
  } catch (error) {
    reportError("注册面板入口失败", error);
  }
})();

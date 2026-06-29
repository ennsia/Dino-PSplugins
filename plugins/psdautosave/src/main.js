(function startPsdAutoSave() {
  const STORAGE_KEY = "psdAutoSave.settings.v1";
  const INTERVALS = {
    30: { label: "30 分钟", minutes: 30 },
    60: { label: "1 小时", minutes: 60 },
    120: { label: "2 小时", minutes: 120 },
    manual: { label: "仅手动", minutes: null },
  };

  let photoshopApi = null;
  let uxpApi = null;
  let initialized = false;
  let backupFolder = null;
  let timerId = null;
  let elapsedTimerId = null;
  let lastElapsedTickAt = 0;
  let lastElapsedPersistedAt = 0;
  let isBackingUp = false;
  let logFileEntry = null;
  let logWriteChain = Promise.resolve();
  const logLines = [];

  const state = {
    enabled: false,
    interval: "manual",
    folderToken: "",
    folderLabel: "未选择",
    target: null,
    currentStatus: "未启用",
    autoElapsedMs: 0,
    lastBackupName: "",
    lastBackupTime: "",
    lastError: "",
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function getCore() {
    if (!window.PsdAutoSaveCore) {
      throw new Error("psdautosave 核心模块加载失败");
    }
    return window.PsdAutoSaveCore;
  }

  function getActiveDocument() {
    return photoshopApi && photoshopApi.app ? photoshopApi.app.activeDocument || null : null;
  }

  function getOpenDocuments() {
    if (!photoshopApi || !photoshopApi.app || !photoshopApi.app.documents) {
      return [];
    }

    try {
      return Array.from(photoshopApi.app.documents || []);
    } catch (error) {
      appendDiagnostic("读取已打开文档列表失败：" + (error && error.message ? error.message : error), "warn");
      return [];
    }
  }

  function appendDiagnostic(message, tone) {
    const line =
      new Date().toISOString() +
      " [" +
      (tone || "info").toUpperCase() +
      "] " +
      message;
    logLines.push(line);
    if (logLines.length > 500) {
      logLines.splice(0, logLines.length - 500);
    }
    console.log("[psdautosave]", message);

    if (!logFileEntry) {
      return;
    }

    const snapshot =
      "psdautosave diagnostic log\n" +
      "Version: 0.1.1\n" +
      "This MVP never deletes backup files.\n\n" +
      logLines.join("\n") +
      "\n";
    logWriteChain = logWriteChain
      .catch(function ignorePreviousLogFailure() {})
      .then(function writeLog() {
        return logFileEntry.write(snapshot);
      })
      .catch(function logWriteFailed(error) {
        console.error("[psdautosave] 写入诊断日志失败", error);
      });
  }

  async function initializeLogFile() {
    try {
      const folder = await uxpApi.storage.localFileSystem.getDataFolder();
      logFileEntry = await folder.createFile("psdautosave-latest.log", {
        overwrite: true,
      });
      appendDiagnostic("诊断日志已初始化：" + (logFileEntry.nativePath || logFileEntry.name));
    } catch (error) {
      console.error("[psdautosave] 无法创建诊断日志", error);
    }
  }

  function intervalLabel(value) {
    return (INTERVALS[value] && INTERVALS[value].label) || INTERVALS.manual.label;
  }

  function formatElapsed(ms) {
    if (!Number.isFinite(ms) || ms < 0) {
      return "00:00:00";
    }

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    function two(value) {
      return String(value).padStart(2, "0");
    }

    return two(hours) + ":" + two(minutes) + ":" + two(seconds);
  }

  function updateElapsedDisplay() {
    const elapsedTime = byId("elapsedTime");
    if (!elapsedTime) {
      return;
    }

    if (!state.enabled && !state.autoElapsedMs) {
      elapsedTime.textContent = "未开始";
      elapsedTime.dataset.tone = "info";
      return;
    }

    elapsedTime.textContent = formatElapsed(getCurrentElapsedMs());
    elapsedTime.dataset.tone = "success";
  }

  function getCurrentElapsedMs() {
    return Number(state.autoElapsedMs || 0);
  }

  function persistCurrentElapsed() {
    lastElapsedPersistedAt = Date.now();
    persistSettings();
  }

  function tickElapsedDisplay() {
    if (state.enabled && lastElapsedTickAt) {
      const now = Date.now();
      const delta = Math.max(0, Math.min(now - lastElapsedTickAt, 1500));
      state.autoElapsedMs = Number(state.autoElapsedMs || 0) + delta;
      lastElapsedTickAt = now;
    }

    updateElapsedDisplay();
    if (Date.now() - lastElapsedPersistedAt >= 5000) {
      persistCurrentElapsed();
    }
  }

  function startElapsedTicker() {
    if (elapsedTimerId) {
      clearInterval(elapsedTimerId);
      elapsedTimerId = null;
    }

    if (!state.enabled) {
      updateElapsedDisplay();
      return;
    }

    lastElapsedTickAt = Date.now();
    lastElapsedPersistedAt = lastElapsedTickAt;
    updateElapsedDisplay();
    elapsedTimerId = setInterval(tickElapsedDisplay, 1000);
  }

  function stopElapsedTicker() {
    if (elapsedTimerId) {
      clearInterval(elapsedTimerId);
      elapsedTimerId = null;
    }
    tickElapsedDisplay();
    persistCurrentElapsed();
    lastElapsedTickAt = 0;
    updateElapsedDisplay();
  }

  function statusTone(status) {
    if (status === "备份成功") {
      return "success";
    }
    if (status === "备份失败" || state.lastError) {
      return "error";
    }
    if (status === "正在备份") {
      return "warn";
    }
    return "info";
  }

  function targetSummary(target) {
    if (!target) {
      return "未绑定";
    }

    return target.path ? target.name + " · " + target.path : target.name;
  }

  function applyState(patch) {
    Object.keys(patch || {}).forEach(function assign(key) {
      state[key] = patch[key];
    });
    persistSettings();
    render();
  }

  function persistSettings() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: state.enabled,
          interval: state.interval,
          folderToken: state.folderToken,
          folderLabel: state.folderLabel,
          target: state.target,
          currentStatus: state.currentStatus,
          autoElapsedMs: state.autoElapsedMs,
          lastBackupName: state.lastBackupName,
          lastBackupTime: state.lastBackupTime,
          lastError: state.lastError,
        })
      );
    } catch (error) {
      console.warn("[psdautosave] 保存设置失败", error);
    }
  }

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!stored || typeof stored !== "object") {
        return;
      }
      state.enabled = Boolean(stored.enabled);
      state.interval = INTERVALS[stored.interval] ? stored.interval : "manual";
      state.folderToken = stored.folderToken || "";
      state.folderLabel = stored.folderLabel || "未选择";
      state.target = stored.target && typeof stored.target === "object" ? stored.target : null;
      state.currentStatus = stored.currentStatus || (state.enabled ? "已启用" : "未启用");
      state.autoElapsedMs = Number(stored.autoElapsedMs || 0);
      state.lastBackupName = stored.lastBackupName || "";
      state.lastBackupTime = stored.lastBackupTime || "";
      state.lastError = stored.lastError || "";
    } catch (error) {
      console.warn("[psdautosave] 读取设置失败，将使用默认设置。", error);
    }
  }

  function render() {
    const enabledBadge = byId("enabledBadge");
    const folderPath = byId("folderPath");
    const targetName = byId("targetName");
    const targetStatus = byId("targetStatus");
    const intervalText = byId("intervalLabel");
    const currentStatus = byId("currentStatus");
    const lastBackup = byId("lastBackup");
    const errorRow = byId("errorRow");
    const lastError = byId("lastError");
    const message = byId("message");

    if (enabledBadge) {
      enabledBadge.textContent = state.enabled ? "已启用" : "未启用";
      enabledBadge.dataset.enabled = state.enabled ? "true" : "false";
    }
    if (folderPath) {
      folderPath.textContent = backupFolder ? state.folderLabel : "未选择";
      folderPath.title = backupFolder ? state.folderLabel : "";
    }
    if (targetName) {
      targetName.textContent = targetSummary(state.target);
      targetName.title = targetSummary(state.target);
    }
    if (targetStatus) {
      targetStatus.textContent = state.target ? state.target.name : "未绑定";
      targetStatus.dataset.tone = state.target ? "success" : "warn";
    }
    if (intervalText) {
      intervalText.textContent = "当前：" + intervalLabel(state.interval);
    }
    if (currentStatus) {
      currentStatus.textContent = state.currentStatus;
      currentStatus.dataset.tone = statusTone(state.currentStatus);
    }
    if (lastBackup) {
      lastBackup.textContent = state.lastBackupName
        ? state.lastBackupName + " · " + state.lastBackupTime
        : "尚无";
    }
    if (errorRow && lastError) {
      errorRow.classList.toggle("hidden", !state.lastError);
    }
    if (lastError) {
      lastError.textContent = state.lastError;
    }
    if (message) {
      message.textContent = state.lastError || state.currentStatus;
      message.dataset.tone = statusTone(state.currentStatus);
    }
    updateElapsedDisplay();

    Array.from(document.querySelectorAll(".interval-button")).forEach(function mark(button) {
      button.dataset.selected = button.dataset.interval === state.interval ? "true" : "false";
    });

    const stopButton = byId("stopAutoBackup");
    if (stopButton) {
      stopButton.disabled = !timerId && !state.enabled;
    }
  }

  function reportError(prefix, error) {
    const detail = error && error.message ? error.message : String(error);
    appendDiagnostic(prefix + "：" + detail, "error");
    applyState({
      currentStatus: "备份失败",
      lastError: prefix + "：" + detail,
    });
    console.error("[psdautosave]", prefix, error);
  }

  function folderLabel(folder) {
    return (folder && (folder.nativePath || folder.name)) || "已选择备份目录";
  }

  async function restoreBackupFolder() {
    if (!state.folderToken) {
      backupFolder = null;
      return;
    }

    try {
      backupFolder = await uxpApi.storage.localFileSystem.getEntryForPersistentToken(
        state.folderToken
      );
      state.folderLabel = folderLabel(backupFolder);
      appendDiagnostic("已恢复备份目录权限：" + state.folderLabel, "success");
    } catch (error) {
      backupFolder = null;
      state.folderToken = "";
      state.folderLabel = "未选择";
      state.enabled = false;
      state.currentStatus = "未启用";
      state.autoElapsedMs = 0;
      state.lastError = "上次备份目录权限已失效，请重新选择目录";
      stopAutoBackup({ silent: true });
      persistSettings();
      appendDiagnostic("恢复备份目录权限失败：" + (error && error.message ? error.message : error), "error");
    }
  }

  async function chooseBackupFolder() {
    try {
      const folder = await uxpApi.storage.localFileSystem.getFolder();
      if (!folder) {
        return;
      }

      const token = await uxpApi.storage.localFileSystem.createPersistentToken(folder);
      backupFolder = folder;
      applyState({
        folderToken: token,
        folderLabel: folderLabel(folder),
        lastError: "",
        currentStatus: state.enabled ? "已启用" : "未启用",
      });
      appendDiagnostic("用户选择备份目录：" + state.folderLabel, "success");
    } catch (error) {
      reportError("选择备份目录失败", error);
    }
  }

  function resolveBoundDocument() {
    const core = getCore();
    const target = state.target;
    if (!target) {
      return {
        ok: false,
        message: "请先绑定当前 PSD/PSB 作为备份目标",
      };
    }

    const activeDocument = getActiveDocument();
    const activeInfo = core.getActiveDocumentInfo(activeDocument);
    if (activeDocument && core.documentMatchesTarget(activeDocument, target)) {
      return {
        ok: true,
        document: activeDocument,
        activeDocument,
        activeInfo,
        targetWasActive: true,
      };
    }

    const documents = getOpenDocuments();
    for (const documentRef of documents) {
      if (core.documentMatchesTarget(documentRef, target)) {
        return {
          ok: true,
          document: documentRef,
          activeDocument,
          activeInfo,
          targetWasActive: false,
        };
      }
    }

    return {
      ok: false,
      message: "绑定文档未打开，本轮跳过：" + target.name,
      activeDocument,
      activeInfo,
    };
  }

  async function bindCurrentTarget() {
    try {
      const core = getCore();
      const info = core.getActiveDocumentInfo(getActiveDocument());
      if (!info.ok) {
        applyState({
          currentStatus: "备份失败",
          lastError: info.message,
        });
        appendDiagnostic("绑定目标失败：" + info.message, "warn");
        return;
      }

      const target = core.createDocumentTarget(info);
      applyState({
        target,
        lastError: "",
        currentStatus: state.enabled ? "已启用" : "未启用",
      });
      appendDiagnostic("已绑定备份目标：" + targetSummary(target), "success");
    } catch (error) {
      reportError("绑定备份目标失败", error);
    }
  }

  async function saveDocumentCopy(documentRef, fileEntry, ext) {
    if (!documentRef || !documentRef.saveAs) {
      throw new Error("当前 Photoshop 版本未提供文档保存接口");
    }

    const saveAs = documentRef.saveAs;
    const method = String(ext).toLowerCase() === "psb" ? saveAs.psb : saveAs.psd;
    if (typeof method !== "function") {
      throw new Error("当前 Photoshop 版本未提供 " + ext.toUpperCase() + " 保存接口");
    }

    // Photoshop UXP DOM is expected to support saveAs.psd/psb(entry, options, asCopy).
    // TODO: Re-verify across Photoshop builds before marking this as a stable release.
    return method.call(saveAs, fileEntry, {}, true);
  }

  async function backupNow(trigger) {
    if (isBackingUp) {
      applyState({
        currentStatus: "上一次备份尚未完成，本轮跳过",
        lastError: "上一次备份尚未完成，本轮跳过",
      });
      appendDiagnostic("上一次备份尚未完成，本轮跳过", "warn");
      return null;
    }

    if (!backupFolder) {
      applyState({
        currentStatus: "备份失败",
        lastError: "请先选择备份目录",
      });
      appendDiagnostic("备份被阻止：请先选择备份目录", "warn");
      return null;
    }

    const targetContext = resolveBoundDocument();
    if (!targetContext.ok) {
      applyState({
        currentStatus: "备份失败",
        lastError: targetContext.message,
      });
      appendDiagnostic("备份被阻止：" + targetContext.message, "warn");
      return null;
    }

    const core = getCore();
    const info = core.getActiveDocumentInfo(targetContext.document);
    if (!info.ok) {
      applyState({
        currentStatus: "备份失败",
        lastError: info.message,
      });
      appendDiagnostic("备份被阻止：" + info.message, "warn");
      return null;
    }

    isBackingUp = true;
    applyState({
      currentStatus: "正在备份",
      lastError: "",
    });
    appendDiagnostic(
      "开始备份绑定目标：" +
        info.name +
        "，触发来源：" +
        (trigger || "manual") +
        "，目标是否为当前活动文档：" +
        (targetContext.targetWasActive ? "是" : "否")
    );

    try {
      const activeBeforeSave = getActiveDocument();
      const activeBeforeId =
        activeBeforeSave && activeBeforeSave.id !== undefined ? Number(activeBeforeSave.id) : null;
      const timestamp = new Date();
      const rawName = core.buildBackupFileName(info.name, timestamp);
      const parts = core.splitFileName(rawName);
      const uniqueName = await core.ensureUniqueBackupName(backupFolder, parts.stem, parts.ext);
      const fileEntry = await backupFolder.createFile(uniqueName, { overwrite: false });
      appendDiagnostic("已创建目标备份文件入口：" + uniqueName);

      await photoshopApi.core.executeAsModal(
        async function saveCopyModal() {
          await saveDocumentCopy(info.document, fileEntry, info.ext);
        },
        { commandName: "psdautosave 备份副本" }
      );

      const activeAfterSave = getActiveDocument();
      const activeAfterId =
        activeAfterSave && activeAfterSave.id !== undefined ? Number(activeAfterSave.id) : null;
      if (activeBeforeId !== activeAfterId) {
        // Do not try to switch documents back here; report the host behavior so the user can verify safely.
        throw new Error("保存后活动文档发生变化，请检查非活动文档 save as copy 行为");
      }

      applyState({
        currentStatus: "备份成功",
        lastBackupName: uniqueName,
        lastBackupTime: timestamp.toLocaleString(),
        lastError: "",
      });
      appendDiagnostic("备份完成：" + uniqueName, "success");
      return uniqueName;
    } catch (error) {
      reportError("备份失败", error);
      return null;
    } finally {
      isBackingUp = false;
    }
  }

  function stopAutoBackup(options) {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      appendDiagnostic("已清除自动备份 timer");
    }

    if (!options || !options.silent) {
      applyState({
        enabled: false,
        autoElapsedMs: 0,
        currentStatus: "未启用",
      });
      stopElapsedTicker();
      appendDiagnostic("自动备份已停止");
    }
  }

  function scheduleCurrentInterval() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      appendDiagnostic("切换前已清除旧 timer");
    }

    const setting = INTERVALS[state.interval] || INTERVALS.manual;
    if (!state.enabled || setting.minutes === null) {
      appendDiagnostic("当前间隔为手动或未启用，不启动 timer：" + intervalLabel(state.interval));
      return;
    }

    timerId = setInterval(function runScheduledBackup() {
      backupNow("timer");
    }, setting.minutes * 60 * 1000);
    appendDiagnostic("已启动自动备份 timer：" + intervalLabel(state.interval), "success");
  }

  async function startAutoBackup() {
    if (!backupFolder) {
      applyState({
        enabled: false,
        currentStatus: "备份失败",
        lastError: "请先选择备份目录",
      });
      return;
    }

    if (!state.target) {
      applyState({
        enabled: false,
        currentStatus: "备份失败",
        lastError: "请先绑定当前 PSD/PSB 作为备份目标",
      });
      return;
    }

    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      appendDiagnostic("启用前已清除旧 timer");
    }

    applyState({
      enabled: true,
      autoElapsedMs: 0,
      currentStatus: "已启用",
      lastError: "",
    });
    startElapsedTicker();
    scheduleCurrentInterval();
    appendDiagnostic("自动备份已启用，将立即执行一次备份。", "success");
    await backupNow("start");
  }

  function setBackupInterval(value) {
    const nextValue = INTERVALS[value] ? value : "manual";
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      appendDiagnostic("切换档位时已清除旧 timer");
    }

    applyState({
      interval: nextValue,
      currentStatus: state.enabled ? "已启用" : "未启用",
      lastError: "",
    });
    scheduleCurrentInterval();
    appendDiagnostic("备份间隔已切换为：" + intervalLabel(state.interval));
  }

  function bindEvents() {
    byId("chooseFolder").addEventListener("click", chooseBackupFolder);
    byId("bindTarget").addEventListener("click", bindCurrentTarget);
    byId("backupNow").addEventListener("click", function manualBackup() {
      backupNow("manual");
    });
    byId("startAutoBackup").addEventListener("click", startAutoBackup);
    byId("stopAutoBackup").addEventListener("click", stopAutoBackup);
    Array.from(document.querySelectorAll(".interval-button")).forEach(function bindInterval(button) {
      button.addEventListener("click", function changeInterval() {
        setBackupInterval(button.dataset.interval);
      });
    });
  }

  async function initialize() {
    if (initialized) {
      render();
      return;
    }

    try {
      getCore();
      photoshopApi = require("photoshop");
      uxpApi = require("uxp");
      await initializeLogFile();
      loadSettings();
      bindEvents();
      await restoreBackupFolder();
      initialized = true;
      render();
      appendDiagnostic("面板初始化完成。当前档位：" + intervalLabel(state.interval));

      if (state.enabled && backupFolder) {
        startElapsedTicker();
        scheduleCurrentInterval();
      }
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
        psdAutoSave: {
          create: function createPanel() {},
          show: showPanel,
          hide: function hidePanel() {},
          destroy: function destroyPanel() {
            stopElapsedTicker();
          },
        },
      },
    });
  } catch (error) {
    reportError("注册面板入口失败", error);
  }
})();

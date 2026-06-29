(function attachPsdAutoSaveCore(root) {
  const SUPPORTED_EXTENSIONS = ["psd", "psb"];

  function two(value) {
    return String(value).padStart(2, "0");
  }

  function formatTimestamp(date) {
    const value = date instanceof Date ? date : new Date(date);
    return (
      value.getFullYear() +
      two(value.getMonth() + 1) +
      two(value.getDate()) +
      "_" +
      two(value.getHours()) +
      two(value.getMinutes()) +
      two(value.getSeconds())
    );
  }

  function splitFileName(fileName) {
    const safeName = String(fileName || "").trim();
    const dotIndex = safeName.lastIndexOf(".");
    if (dotIndex <= 0 || dotIndex === safeName.length - 1) {
      return { stem: safeName, ext: "" };
    }
    return {
      stem: safeName.slice(0, dotIndex),
      ext: safeName.slice(dotIndex + 1).toLowerCase(),
    };
  }

  function isSupportedExtension(ext) {
    return SUPPORTED_EXTENSIONS.includes(String(ext || "").toLowerCase());
  }

  function buildBackupFileName(documentName, timestamp) {
    const parts = splitFileName(documentName);
    const ext = isSupportedExtension(parts.ext) ? parts.ext : "psd";
    return parts.stem + "__autosave__" + formatTimestamp(timestamp) + "." + ext;
  }

  async function folderHasEntry(folder, name) {
    if (!folder || typeof folder.getEntry !== "function") {
      throw new Error("备份目录不可用");
    }

    try {
      await folder.getEntry(name);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function ensureUniqueBackupName(folder, baseName, ext) {
    const cleanBase = String(baseName || "untitled").trim() || "untitled";
    const cleanExt = String(ext || "psd").replace(/^\./, "").toLowerCase();
    let candidate = cleanBase + "." + cleanExt;

    if (!(await folderHasEntry(folder, candidate))) {
      return candidate;
    }

    for (let index = 1; index <= 99; index += 1) {
      candidate = cleanBase + "_" + two(index) + "." + cleanExt;
      if (!(await folderHasEntry(folder, candidate))) {
        return candidate;
      }
    }

    throw new Error("备份文件名冲突过多，请稍后重试");
  }

  function getDocumentDisplayName(documentRef) {
    return (
      (documentRef && (documentRef.title || documentRef.name)) ||
      ""
    );
  }

  function normalizeDocumentPath(pathValue) {
    if (!pathValue) {
      return "";
    }

    if (typeof pathValue === "string") {
      return pathValue;
    }

    return pathValue.nativePath || pathValue.fsName || pathValue.path || String(pathValue);
  }

  function hasLocalPath(documentRef) {
    if (!documentRef) {
      return false;
    }

    return normalizeDocumentPath(documentRef.path).length > 0;
  }

  function getActiveDocumentInfo(documentRef) {
    if (!documentRef) {
      return {
        ok: false,
        code: "NO_DOCUMENT",
        message: "没有打开文档",
      };
    }

    const name = getDocumentDisplayName(documentRef);
    const parts = splitFileName(name);

    if (!parts.ext) {
      return {
        ok: false,
        code: "UNSAVED",
        message: "请先保存为 PSD/PSB",
        document: documentRef,
        name,
      };
    }

    if (!isSupportedExtension(parts.ext)) {
      return {
        ok: false,
        code: "UNSUPPORTED_FORMAT",
        message: "当前仅支持 PSD/PSB",
        document: documentRef,
        name,
        ext: parts.ext,
      };
    }

    // TODO: Re-check document.path exposure across Photoshop UXP versions.
    // If the host exposes the property, use it to block cloud/unsaved files for this MVP.
    if ("path" in documentRef && !hasLocalPath(documentRef)) {
      return {
        ok: false,
        code: "NO_LOCAL_PATH",
        message: "当前仅支持本地 PSD/PSB，请先保存到本地磁盘",
        document: documentRef,
        name,
        ext: parts.ext,
      };
    }

    return {
      ok: true,
      code: "OK",
      message: "",
      document: documentRef,
      name,
      stem: parts.stem,
      ext: parts.ext,
      id: documentRef.id,
      path: normalizeDocumentPath(documentRef.path),
    };
  }

  function createDocumentTarget(info) {
    if (!info || !info.ok) {
      return null;
    }

    return {
      id: info.id === undefined || info.id === null ? null : Number(info.id),
      name: info.name,
      path: info.path || "",
      ext: info.ext,
    };
  }

  function documentMatchesTarget(documentRef, target) {
    if (!documentRef || !target) {
      return false;
    }

    const targetPath = normalizeDocumentPath(target.path);
    const documentPath = normalizeDocumentPath(documentRef.path);
    if (targetPath && documentPath) {
      return targetPath === documentPath;
    }

    if (target.id !== null && target.id !== undefined && documentRef.id !== undefined) {
      return Number(documentRef.id) === Number(target.id);
    }

    return false;
  }

  root.PsdAutoSaveCore = {
    SUPPORTED_EXTENSIONS,
    buildBackupFileName,
    createDocumentTarget,
    documentMatchesTarget,
    ensureUniqueBackupName,
    formatTimestamp,
    getActiveDocumentInfo,
    normalizeDocumentPath,
    isSupportedExtension,
    splitFileName,
  };
})(typeof window !== "undefined" ? window : globalThis);

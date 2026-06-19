(function attachLayerQuickJumpUtils(root) {
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

  function findLayerById(layers, targetId, parentNames) {
    const parents = parentNames || [];

    for (const layer of Array.from(layers || [])) {
      const layerId = Number(layer.id);
      const name = layer.name || "未命名图层";
      const pathParts = parents.concat(name);

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

  function getDocumentLabel(documentRef) {
    return documentRef && documentRef.title ? documentRef.title : "Untitled";
  }

  function getDocumentId(documentRef) {
    return !documentRef || documentRef.id === undefined ? null : documentRef.id;
  }

  function createLayerRecord(documentRef, now) {
    let activeLayers = [];

    try {
      activeLayers = Array.from((documentRef && documentRef.activeLayers) || []);
    } catch (error) {
      return null;
    }

    const activeLayer = activeLayers[0];
    if (!activeLayer) {
      return null;
    }

    const found = findLayerById(documentRef.layers, activeLayer.id);

    return {
      id: Number(activeLayer.id),
      name: activeLayer.name || (found && found.name) || "未命名图层",
      path: (found && found.path) || activeLayer.name || "未命名图层",
      documentId: getDocumentId(documentRef),
      documentName: getDocumentLabel(documentRef),
      savedAt: (now || new Date()).toISOString(),
    };
  }

  const api = {
    createLayerRecord,
    findLayerById,
    getDocumentId,
    getDocumentLabel,
    getLayerChildren,
  };

  root.LayerQuickJumpUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

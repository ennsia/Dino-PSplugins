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

  function findLayerObjectById(layers, targetId) {
    for (const layer of Array.from(layers || [])) {
      if (Number(layer.id) === Number(targetId)) {
        return layer;
      }

      const found = findLayerObjectById(getLayerChildren(layer), targetId);
      if (found) {
        return found;
      }
    }

    return null;
  }

  function containsLayerId(layer, targetId) {
    return Boolean(findLayerObjectById(getLayerChildren(layer), targetId));
  }

  function sortLayersByDocumentOrder(layers, selectedLayers) {
    const positions = new Map();
    let position = 0;

    function visit(layerList) {
      for (const layer of Array.from(layerList || [])) {
        positions.set(Number(layer.id), position);
        position += 1;
        visit(getLayerChildren(layer));
      }
    }

    visit(layers);

    return Array.from(selectedLayers || []).sort(function compareLayers(first, second) {
      const firstPosition = positions.has(Number(first.id))
        ? positions.get(Number(first.id))
        : Number.MAX_SAFE_INTEGER;
      const secondPosition = positions.has(Number(second.id))
        ? positions.get(Number(second.id))
        : Number.MAX_SAFE_INTEGER;
      return firstPosition - secondPosition;
    });
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
    containsLayerId,
    findLayerById,
    findLayerObjectById,
    getDocumentId,
    getDocumentLabel,
    getLayerChildren,
    sortLayersByDocumentOrder,
  };

  root.LayerQuickJumpUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

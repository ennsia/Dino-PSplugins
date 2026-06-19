(function attachColorMergePlanner(root) {
  function toArray(value) {
    try {
      return Array.from(value || []);
    } catch (error) {
      return [];
    }
  }

  function getChildren(layer) {
    return toArray(layer && layer.layers);
  }

  function isGroup(layer) {
    return getChildren(layer).length > 0 || String(layer && layer.kind).toLowerCase() === "group";
  }

  function getDocumentId(documentRef) {
    return documentRef && documentRef.id !== undefined ? Number(documentRef.id) : null;
  }

  function getDocumentName(documentRef) {
    return (documentRef && documentRef.title) || "Untitled";
  }

  function layerId(layer) {
    return Number(layer && layer.id);
  }

  function layerName(layer) {
    return (layer && layer.name) || "未命名图层";
  }

  function layerVisible(layer) {
    return !layer || layer.visible !== false;
  }

  function isClippingLayer(layer) {
    return Boolean(
      layer &&
        (layer.isClippingMask === true ||
          layer.clipped === true ||
          layer.grouped === true ||
          layer.isClipped === true)
    );
  }

  function getLockReasons(layer) {
    const reasons = [];
    if (!layer) {
      return reasons;
    }
    if (layer.isBackgroundLayer === true || layer.background === true) {
      reasons.push("背景图层");
    }
    if (layer.allLocked === true || layer.locked === true) {
      reasons.push("完全锁定");
    }
    if (layer.pixelsLocked === true) {
      reasons.push("像素锁定");
    }
    if (layer.positionLocked === true) {
      reasons.push("位置锁定");
    }
    if (layer.transparentPixelsLocked === true) {
      reasons.push("透明像素锁定");
    }
    return Array.from(new Set(reasons));
  }

  function buildIndex(layers) {
    const byId = new Map();
    const order = new Map();
    let cursor = 0;

    function visit(list, parentNames, parentId, parentLocator) {
      const siblings = toArray(list);
      siblings.forEach(function indexLayer(layer, siblingIndex) {
        const id = layerId(layer);
        const name = layerName(layer);
        const pathParts = parentNames.concat(name);
        const locator = (parentLocator || []).concat(siblingIndex);
        byId.set(id, {
          id,
          layer,
          name,
          path: pathParts.join(" / "),
          locator,
          parentId: parentId === undefined ? null : parentId,
          siblings,
          siblingIndex,
        });
        order.set(id, cursor);
        cursor += 1;
        visit(getChildren(layer), pathParts, id, locator);
      });
    }

    visit(layers, [], null, []);
    return { byId, order };
  }

  function sortByDocumentOrder(index, layers) {
    return toArray(layers).sort(function compare(first, second) {
      return (
        (index.order.get(layerId(first)) ?? Number.MAX_SAFE_INTEGER) -
        (index.order.get(layerId(second)) ?? Number.MAX_SAFE_INTEGER)
      );
    });
  }

  function makeRecord(documentRef, layer, index) {
    const indexed = index.byId.get(layerId(layer));
    return {
      id: layerId(layer),
      name: layerName(layer),
      path: indexed ? indexed.path : layerName(layer),
      locator: indexed ? indexed.locator : null,
      documentId: getDocumentId(documentRef),
      documentName: getDocumentName(documentRef),
      isGroup: isGroup(layer),
    };
  }

  function createSelectionRecord(documentRef, role, now) {
    const index = buildIndex(documentRef && documentRef.layers);
    const selected = sortByDocumentOrder(index, documentRef && documentRef.activeLayers);
    if (selected.length === 0) {
      return null;
    }

    return {
      role,
      documentId: getDocumentId(documentRef),
      documentName: getDocumentName(documentRef),
      savedAt: (now || new Date()).toISOString(),
      layers: selected.map(function mapLayer(layer) {
        return makeRecord(documentRef, layer, index);
      }),
    };
  }

  function resolveRecord(documentRef, record) {
    if (!record || getDocumentId(documentRef) !== Number(record.documentId)) {
      return null;
    }
    return buildIndex(documentRef.layers).byId.get(Number(record.id)) || null;
  }

  function expandTargets(documentRef, targetRecord) {
    const index = buildIndex(documentRef.layers);
    const expanded = [];
    const warnings = [];
    const seen = new Set();

    function addLayer(layer, sourcePath) {
      const id = layerId(layer);
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      expanded.push({
        id,
        layer,
        name: layerName(layer),
        path: (index.byId.get(id) && index.byId.get(id).path) || sourcePath || layerName(layer),
        locator: (index.byId.get(id) && index.byId.get(id).locator) || null,
      });
    }

    function expandGroup(group, groupPath) {
      const children = getChildren(group);
      if (children.length === 0) {
        warnings.push("目标组为空：" + groupPath);
        return;
      }

      children.forEach(function expandChild(child) {
        const childPath =
          (index.byId.get(layerId(child)) && index.byId.get(layerId(child)).path) ||
          groupPath + " / " + layerName(child);
        if (isGroup(child)) {
          expandGroup(child, childPath);
          return;
        }
        if (isClippingLayer(child)) {
          return;
        }
        addLayer(child, childPath);
      });
    }

    for (const record of (targetRecord && targetRecord.layers) || []) {
      const resolved = index.byId.get(Number(record.id));
      if (!resolved) {
        warnings.push("目标已不存在：" + record.path);
        continue;
      }

      if (!isGroup(resolved.layer)) {
        addLayer(resolved.layer, resolved.path);
        continue;
      }

      expandGroup(resolved.layer, resolved.path);
    }

    return {
      targets: sortByDocumentOrder(index, expanded.map(function unwrap(item) { return item.layer; })).map(
        function restore(layer) {
          return expanded.find(function find(item) { return item.id === layerId(layer); });
        }
      ),
      warnings,
      index,
    };
  }

  function collectClippingChain(target, index) {
    const entry = index.byId.get(layerId(target));
    if (!entry) {
      return [];
    }

    const chain = [];
    for (let cursor = entry.siblingIndex - 1; cursor >= 0; cursor -= 1) {
      const candidate = entry.siblings[cursor];
      if (!isClippingLayer(candidate)) {
        break;
      }
      chain.push(candidate);
    }
    return chain;
  }

  function buildDryRun(documentRef, sourceRecord, targetRecord) {
    const errors = [];
    const warnings = [];
    const documentId = getDocumentId(documentRef);

    if (!documentRef) {
      return { errors: ["没有打开的 Photoshop 文档"], warnings, operations: [], locks: [] };
    }
    if (!sourceRecord || !targetRecord) {
      return { errors: ["请先记录调色层和目标层"], warnings, operations: [], locks: [] };
    }
    if (
      Number(sourceRecord.documentId) !== documentId ||
      Number(targetRecord.documentId) !== documentId
    ) {
      return { errors: ["两个锚点必须来自当前同一文档"], warnings, operations: [], locks: [] };
    }

    const index = buildIndex(documentRef.layers);
    const sources = [];
    for (const record of sourceRecord.layers || []) {
      const resolved = index.byId.get(Number(record.id));
      if (!resolved) {
        errors.push("调色层已不存在：" + record.path);
      } else if (isGroup(resolved.layer)) {
        errors.push("调色源不能是图层组：" + resolved.path);
      } else {
        sources.push(resolved.layer);
      }
    }

    const expansion = expandTargets(documentRef, targetRecord);
    warnings.push.apply(warnings, expansion.warnings);
    const targets = expansion.targets;
    if (targets.length === 0) {
      errors.push("没有可处理的目标层");
    }

    const sourceIds = new Set(sources.map(layerId));
    targets.forEach(function rejectOverlap(target) {
      if (sourceIds.has(target.id)) {
        errors.push("调色源与目标重叠：" + target.path);
      }
    });

    const locks = [];
    const operations = [];
    let mergeCount = 0;
    let hiddenDeleteCount = 0;

    targets.forEach(function planTarget(target, targetIndex) {
      const targetLocks = getLockReasons(target.layer);
      if (targetLocks.length > 0) {
        locks.push({ id: target.id, path: target.path, reasons: targetLocks });
      }

      const clippingChain = collectClippingChain(target.layer, index);
      const clippingOperations = [];
      clippingChain.forEach(function planExistingClip(clip) {
        const clipPath = (index.byId.get(layerId(clip)) || {}).path || layerName(clip);
        const clipLocks = getLockReasons(clip);
        if (clipLocks.length > 0) {
          locks.push({ id: layerId(clip), path: clipPath, reasons: clipLocks });
        }
        if (!layerVisible(clip)) {
          hiddenDeleteCount += 1;
          clippingOperations.push({ type: "delete-hidden-clip", layer: clipPath });
        } else {
          mergeCount += 1;
          clippingOperations.push({ type: "merge-existing-clip-down", layer: clipPath });
        }
      });

      const colorOperations = [];
      sources
        .slice()
        .reverse()
        .forEach(function planColorMerge(source) {
          mergeCount += 1;
          colorOperations.push({
            type: "copy-and-merge-color-down",
            layer: (index.byId.get(layerId(source)) || {}).path || layerName(source),
          });
        });

      operations.push({
        index: targetIndex + 1,
        target: target.path,
        targetLocator: target.locator,
        clippingChainCount: clippingChain.length,
        clippingOperations,
        colorOperations,
      });
    });

    const uniqueLocks = Array.from(
      new Map(
        locks.map(function keyLock(item) {
          return [item.id, item];
        })
      ).values()
    );

    return {
      documentId,
      documentName: getDocumentName(documentRef),
      sourceCount: sources.length,
      targetCount: targets.length,
      errors: Array.from(new Set(errors)),
      warnings,
      locks: uniqueLocks,
      operations,
      totals: {
        mergeCount,
        hiddenDeleteCount,
        lockCount: uniqueLocks.length,
      },
    };
  }

  const api = {
    buildDryRun,
    buildIndex,
    collectClippingChain,
    createSelectionRecord,
    expandTargets,
    getLockReasons,
    isClippingLayer,
    isGroup,
    resolveRecord,
  };

  root.ColorMergePlanner = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

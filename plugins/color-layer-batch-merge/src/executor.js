(function attachColorMergeExecutor(root) {
  function toArray(value) {
    try {
      return Array.from(value || []);
    } catch (error) {
      return [];
    }
  }

  function timestamp() {
    const now = new Date();
    function two(value) {
      return String(value).padStart(2, "0");
    }
    return (
      now.getFullYear() +
      two(now.getMonth() + 1) +
      two(now.getDate()) +
      "_" +
      two(now.getHours()) +
      two(now.getMinutes()) +
      two(now.getSeconds())
    );
  }

  function findByPath(documentRef, path) {
    const index = root.ColorMergePlanner.buildIndex(documentRef && documentRef.layers);
    for (const entry of index.byId.values()) {
      if (entry.path === path) {
        return entry.layer;
      }
    }
    return null;
  }

  function findByLocator(documentRef, locator) {
    if (!Array.isArray(locator) || locator.length === 0) {
      return null;
    }
    let list = toArray(documentRef && documentRef.layers);
    let layer = null;
    for (const siblingIndex of locator) {
      layer = list[Number(siblingIndex)] || null;
      if (!layer) {
        return null;
      }
      list = toArray(layer.layers);
    }
    return layer;
  }

  function resolveDuplicateLayer(documentRef, locator, path) {
    return findByLocator(documentRef, locator) || findByPath(documentRef, path);
  }

  async function selectLayer(action, layer) {
    await action.batchPlay(
      [
        {
          _obj: "select",
          _target: [{ _ref: "layer", _id: Number(layer.id) }],
          makeVisible: false,
          _options: { dialogOptions: "dontDisplay" },
        },
      ],
      {}
    );
  }

  async function deleteLayer(layer) {
    if (layer && typeof layer.delete === "function") {
      await layer.delete();
      return;
    }
    throw new Error("Photoshop 未提供删除图层接口：" + ((layer && layer.name) || "未知图层"));
  }

  async function mergeLayerDown(action, layer) {
    await selectLayer(action, layer);
    if (layer && typeof layer.merge === "function") {
      return layer.merge();
    }
    const result = await action.batchPlay(
      [{ _obj: "mergeLayersNew", _options: { dialogOptions: "dontDisplay" } }],
      {}
    );
    return result && result[0];
  }

  async function ensureClipping(action, layer) {
    if (root.ColorMergePlanner.isClippingLayer(layer)) {
      return;
    }
    try {
      layer.isClippingMask = true;
      if (root.ColorMergePlanner.isClippingLayer(layer)) {
        return;
      }
    } catch (error) {
      // 部分 Photoshop 版本或图层类型不允许直接写剪贴属性，改用动作命令。
    }
    await selectLayer(action, layer);
    await action.batchPlay(
      [{ _obj: "groupEvent", _options: { dialogOptions: "dontDisplay" } }],
      {}
    );
  }

  async function unlockLayer(action, layer) {
    if (!layer) {
      return;
    }

    if (layer.isBackgroundLayer === true || layer.background === true) {
      await action.batchPlay(
        [
          {
            _obj: "set",
            _target: [{ _ref: "layer", _id: Number(layer.id) }],
            to: { _obj: "layer" },
            _options: { dialogOptions: "dontDisplay" },
          },
        ],
        {}
      );
    }

    ["allLocked", "pixelsLocked", "positionLocked", "transparentPixelsLocked"].forEach(
      function clearDomLock(property) {
        try {
          if (property in layer) {
            layer[property] = false;
          }
        } catch (error) {
          // 最后的 Action Manager 解锁会覆盖 DOM 不可写的情况。
        }
      }
    );

    await action.batchPlay(
      [
        {
          _obj: "set",
          _target: [{ _ref: "layer", _id: Number(layer.id) }],
          to: {
            _obj: "layer",
            layerLocking: {
              _obj: "layerLocking",
              protectAll: false,
              protectComposite: false,
              protectPosition: false,
              protectTransparency: false,
            },
          },
          _options: { dialogOptions: "dontDisplay" },
        },
      ],
      {}
    );
  }

  async function duplicateBefore(constants, source, target) {
    if (!source || typeof source.duplicate !== "function") {
      throw new Error("Photoshop 未提供复制图层接口：" + ((source && source.name) || "未知图层"));
    }
    return source.duplicate(target, constants.ElementPlacement.PLACEBEFORE);
  }

  async function executeMerge(options) {
    const photoshop = options.photoshop;
    const original = options.document;
    const plan = options.plan;
    const sourceRecord = options.sourceRecord;
    const unlockApproved = options.unlockApproved;
    const log = typeof options.log === "function" ? options.log : function noop() {};

    if (!photoshop || !photoshop.core || !photoshop.action || !photoshop.constants) {
      throw new Error("Photoshop 执行接口不可用");
    }

    async function checkpoint(label, operation) {
      log("[调用开始] " + label);
      try {
        const result = await operation();
        log("[调用完成] " + label, "success");
        return result;
      } catch (error) {
        log(
          "[调用失败] " + label + "：" + (error && error.message ? error.message : String(error)),
          "error"
        );
        throw error;
      }
    }

    log("[宿主] 请求进入 Photoshop 模态执行。");
    return photoshop.core.executeAsModal(
      async function executeInModal(executionContext) {
        log("[宿主] 已进入 Photoshop 模态执行。", "success");
        const copyName = original.title.replace(/\.[^.]+$/, "") + "__调色批处理_" + timestamp();
        const duplicate = await checkpoint("创建完整文档副本：" + copyName, function duplicateDocument() {
          return original.duplicate(copyName, false);
        });
        const hostControl = executionContext.hostControl;
        let historyToken = null;

        try {
          if (hostControl && typeof hostControl.suspendHistory === "function") {
            historyToken = await checkpoint("挂起副本文档历史记录", function suspendHistory() {
              return hostControl.suspendHistory({
                documentID: Number(duplicate.id),
                name: "批量合并调色图层",
              });
            });
          }

          log("[解析] 开始在副本文档中定位调色层与目标层。");
          const sources = (sourceRecord.layers || []).map(function resolveSource(record) {
            const layer = resolveDuplicateLayer(duplicate, record.locator, record.path);
            if (!layer) {
              throw new Error("在副本文档中找不到调色层：" + record.path);
            }
            return layer;
          });
          const targets = plan.operations.map(function resolveTarget(operation) {
            const layer = resolveDuplicateLayer(
              duplicate,
              operation.targetLocator,
              operation.target
            );
            if (!layer) {
              throw new Error("在副本文档中找不到目标层：" + operation.target);
            }
            return { layer, operation };
          });
          log("[解析] 副本文档图层定位完成。", "success");

          for (const item of targets) {
            let target = item.layer;
            const operation = item.operation;
            log("[执行 " + operation.index + "/" + plan.targetCount + "] " + operation.target);

            if (
              unlockApproved &&
              root.ColorMergePlanner.getLockReasons(target).length > 0
            ) {
              await checkpoint("解锁目标层：" + operation.target, function unlockTarget() {
                return unlockLayer(photoshop.action, target);
              });
            }

            let currentIndex = root.ColorMergePlanner.buildIndex(duplicate.layers);
            let clippingChain = root.ColorMergePlanner.collectClippingChain(target, currentIndex);
            for (const clip of clippingChain) {
              if (clip.visible === false) {
                if (
                  unlockApproved &&
                  root.ColorMergePlanner.getLockReasons(clip).length > 0
                ) {
                  await checkpoint("解锁隐藏剪贴层：" + clip.name, function unlockHiddenClip() {
                    return unlockLayer(photoshop.action, clip);
                  });
                }
                await checkpoint("删除隐藏剪贴层：" + clip.name, function removeHiddenClip() {
                  return deleteLayer(clip);
                });
              }
            }

            currentIndex = root.ColorMergePlanner.buildIndex(duplicate.layers);
            clippingChain = root.ColorMergePlanner.collectClippingChain(target, currentIndex);
            for (const clip of clippingChain) {
              if (
                unlockApproved &&
                root.ColorMergePlanner.getLockReasons(clip).length > 0
              ) {
                await checkpoint("解锁原剪贴层：" + clip.name, function unlockExistingClip() {
                  return unlockLayer(photoshop.action, clip);
                });
              }
              const mergedTarget = await checkpoint(
                "向下合并原剪贴层：" + clip.name,
                function mergeExistingClip() {
                  return mergeLayerDown(photoshop.action, clip);
                }
              );
              if (mergedTarget && mergedTarget.id !== undefined) {
                target = mergedTarget;
              }
            }

            const copies = [];
            for (const source of sources) {
              const copied = await checkpoint(
                "复制调色层：" + source.name + " → " + operation.target,
                function copyColorLayer() {
                  return duplicateBefore(photoshop.constants, source, target);
                }
              );
              await checkpoint("设为剪贴蒙版：" + copied.name, function clipCopiedLayer() {
                return ensureClipping(photoshop.action, copied);
              });
              copies.push(copied);
            }
            for (const copied of copies.slice().reverse()) {
              await checkpoint("向下合并调色层：" + copied.name, function mergeColorCopy() {
                return mergeLayerDown(photoshop.action, copied);
              });
            }
          }

          for (const source of sources) {
            await checkpoint("隐藏原始调色层：" + source.name, function hideSourceLayer() {
              source.visible = false;
            });
          }
          log("[整理] 原始调色源层已在副本文档中隐藏。", "success");

          if (historyToken && hostControl && typeof hostControl.resumeHistory === "function") {
            await checkpoint("提交副本文档历史记录", function commitHistory() {
              return hostControl.resumeHistory(historyToken, true);
            });
          }
          log("[完成] 已在副本文档中完成全部合并：" + duplicate.title, "success");
          return { document: duplicate, documentName: duplicate.title };
        } catch (error) {
          if (historyToken && hostControl && typeof hostControl.resumeHistory === "function") {
            try {
              await checkpoint("回滚副本文档历史记录", function rollbackHistory() {
                return hostControl.resumeHistory(historyToken, false);
              });
            } catch (rollbackError) {
              log("[回滚失败] 请关闭生成的副本文档且不要保存。", "error");
            }
          }
          log("[回滚] 执行失败，已尝试撤销副本中的本次历史步骤。", "error");
          throw error;
        }
      },
      { commandName: "批量合并调色图层（安全副本）" }
    );
  }

  const api = {
    executeMerge,
    findByLocator,
    findByPath,
    resolveDuplicateLayer,
  };

  root.ColorMergeExecutor = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);

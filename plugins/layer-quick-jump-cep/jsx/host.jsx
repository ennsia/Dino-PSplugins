var LayerQuickJump = LayerQuickJump || {};

LayerQuickJump.escapeJson = function (value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
};

LayerQuickJump.json = function (pairs) {
  var output = [];
  for (var key in pairs) {
    if (pairs.hasOwnProperty(key)) {
      var value = pairs[key];
      if (typeof value === "number") {
        output.push('"' + key + '":' + value);
      } else {
        output.push('"' + key + '":"' + LayerQuickJump.escapeJson(value) + '"');
      }
    }
  }
  return "{" + output.join(",") + "}";
};

LayerQuickJump.getActiveLayerId = function () {
  var ref = new ActionReference();
  ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("layerID"));
  ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
  var desc = executeActionGet(ref);
  return desc.getInteger(stringIDToTypeID("layerID"));
};

LayerQuickJump.getActiveLayerRecord = function () {
  try {
    if (!app.documents.length) {
      return LayerQuickJump.json({ error: "请先打开 Photoshop 文档。" });
    }

    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    var layerId = LayerQuickJump.getActiveLayerId();

    return LayerQuickJump.json({
      id: layerId,
      name: layer.name || "未命名图层",
      documentName: doc.name || "Untitled",
    });
  } catch (error) {
    return LayerQuickJump.json({ error: "保存失败：" + error.message });
  }
};

LayerQuickJump.selectLayerById = function (layerId) {
  try {
    if (!app.documents.length) {
      return LayerQuickJump.json({ error: "请先打开 Photoshop 文档。" });
    }

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putIdentifier(charIDToTypeID("Lyr "), Number(layerId));
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putBoolean(charIDToTypeID("MkVs"), false);
    executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);

    return LayerQuickJump.json({ ok: "1" });
  } catch (error) {
    return LayerQuickJump.json({ error: "跳转失败：图层可能已删除，或当前文档不是保存记录时的文档。" });
  }
};

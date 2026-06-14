const photoshop = require("photoshop");
const { app, core } = photoshop;

function getActiveDocument() {
  return app.activeDocument || null;
}

function setMessage(text) {
  document.getElementById("message").textContent = text;
}

function refreshDocumentInfo() {
  const documentName = document.getElementById("documentName");
  const layerCount = document.getElementById("layerCount");
  const activeDocument = getActiveDocument();

  if (!activeDocument) {
    documentName.textContent = "No active document";
    layerCount.textContent = "-";
    setMessage("Open a Photoshop document to begin.");
    return;
  }

  documentName.textContent = activeDocument.title || "Untitled";
  layerCount.textContent = String(activeDocument.layers.length);
  setMessage("Document info refreshed.");
}

async function createReviewLayer() {
  const activeDocument = getActiveDocument();

  if (!activeDocument) {
    setMessage("Open a Photoshop document before creating a review layer.");
    return;
  }

  await core.executeAsModal(
    async () => {
      const layer = await activeDocument.createLayer({ name: "Stray Stroke Review" });
      layer.opacity = 35;
    },
    { commandName: "Create stray stroke review layer" }
  );

  refreshDocumentInfo();
  setMessage("Created a review layer.");
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshButton").addEventListener("click", refreshDocumentInfo);
  document
    .getElementById("createReviewLayerButton")
    .addEventListener("click", createReviewLayer);

  refreshDocumentInfo();
});

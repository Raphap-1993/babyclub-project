const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "assets.json");
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "baby-assets");

function ensureStorage() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
  }
}

function readAssets() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Could not read assets.json", err);
    return [];
  }
}

function writeAssets(assets) {
  ensureStorage();
  fs.writeFileSync(DATA_FILE, JSON.stringify(assets, null, 2));
}

function findAsset(id) {
  return readAssets().find((asset) => asset.id === id);
}

module.exports = {
  DATA_FILE,
  UPLOAD_DIR,
  ensureStorage,
  readAssets,
  writeAssets,
  findAsset,
};

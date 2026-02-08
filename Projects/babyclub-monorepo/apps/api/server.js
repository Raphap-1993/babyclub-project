const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const Busboy = require("busboy");
const { randomUUID } = require("crypto");
const {
  ensureStorage,
  readAssets,
  writeAssets,
  findAsset,
  UPLOAD_DIR,
} = require("./routes/assets/store");

const port = process.env.PORT || 4000;
const publicBase = process.env.PUBLIC_API_BASE || `http://localhost:${port}`;

ensureStorage();

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

const json = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const serveStatic = (pathname, res) => {
  if (!pathname.startsWith("/uploads/")) return false;

  const filePath = path.join(__dirname, pathname);
  if (!fs.existsSync(filePath)) {
    json(res, 404, { error: "File not found" });
    return true;
  }

  const stream = fs.createReadStream(filePath);
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  stream.pipe(res);
  return true;
};

const sanitizeFilename = (name) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";

    if (contentType.startsWith("multipart/form-data")) {
      const busboy = Busboy({ headers: req.headers });
      const fields = {};
      let uploadedFile = null;

      busboy.on("file", (_field, file, fileName) => {
        if (!fileName) {
          file.resume();
          return;
        }

        const safeName = `${Date.now()}-${sanitizeFilename(fileName)}`;
        const fullPath = path.join(UPLOAD_DIR, safeName);
        const writeStream = fs.createWriteStream(fullPath);

        file.pipe(writeStream);

        uploadedFile = {
          filename: safeName,
          path: fullPath,
          url: `${publicBase}/uploads/baby-assets/${safeName}`,
        };
      });

      busboy.on("field", (fieldname, value) => {
        fields[fieldname] = value;
      });

      busboy.on("finish", () => resolve({ fields, uploadedFile }));
      busboy.on("error", reject);
      req.pipe(busboy);
      return;
    }

    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve({ fields: JSON.parse(raw || "{}"), uploadedFile: null });
      } catch (err) {
        reject(err);
      }
    });
  });

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "", `http://localhost:${port}`);
  const { pathname } = url;

  if (serveStatic(pathname, res)) return;

  if (pathname === "/assets" && req.method === "GET") {
    return json(res, 200, readAssets());
  }

  if (pathname === "/assets" && req.method === "POST") {
    try {
      const { fields, uploadedFile } = await parseBody(req);
      const assets = readAssets();

      const id = fields.id || sanitizeFilename(fields.name || "") || randomUUID();
      const payload = {
        id,
        name: fields.name || "Nuevo asset",
        type: fields.type || "General",
        description: fields.description || "",
        filename: uploadedFile?.filename || fields.filename || null,
        url:
          uploadedFile?.url ||
          fields.url ||
          (fields.filename ? `${publicBase}/uploads/baby-assets/${fields.filename}` : null),
        updatedAt: new Date().toISOString(),
      };

      assets.unshift(payload);
      writeAssets(assets);
      return json(res, 201, payload);
    } catch (err) {
      console.error("POST /assets error", err);
      return json(res, 500, { error: "Unable to create asset" });
    }
  }

  const assetMatch = pathname.match(/^\/assets\/([^/]+)$/);
  if (assetMatch) {
    const assetId = decodeURIComponent(assetMatch[1]);

    if (req.method === "GET") {
      const asset = findAsset(assetId);
      if (!asset) return json(res, 404, { error: "Asset not found" });
      return json(res, 200, asset);
    }

    if (req.method === "PUT") {
      try {
        const existing = findAsset(assetId);
        if (!existing) return json(res, 404, { error: "Asset not found" });

        const { fields, uploadedFile } = await parseBody(req);

        const nextAsset = {
          ...existing,
          name: fields.name || existing.name,
          type: fields.type || existing.type,
          description: fields.description || existing.description,
          filename: uploadedFile?.filename || existing.filename,
          url:
            uploadedFile?.url ||
            fields.url ||
            existing.url ||
            (existing.filename ? `${publicBase}/uploads/baby-assets/${existing.filename}` : null),
          updatedAt: new Date().toISOString(),
        };

        const assets = readAssets().map((asset) => (asset.id === assetId ? nextAsset : asset));
        writeAssets(assets);
        return json(res, 200, nextAsset);
      } catch (err) {
        console.error("PUT /assets error", err);
        return json(res, 500, { error: "Unable to update asset" });
      }
    }

    if (req.method === "DELETE") {
      try {
        const assets = readAssets();
        const asset = assets.find((item) => item.id === assetId);
        if (!asset) return json(res, 404, { error: "Asset not found" });

        if (asset.filename) {
          const filePath = path.join(UPLOAD_DIR, asset.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }

        writeAssets(assets.filter((item) => item.id !== assetId));
        return json(res, 200, { ok: true });
      } catch (err) {
        console.error("DELETE /assets error", err);
        return json(res, 500, { error: "Unable to delete asset" });
      }
    }
  }

  return json(res, 404, { error: "Not found" });
});

server.listen(port, () => {
  console.log(`Babyclub API ready at ${publicBase}`);
});

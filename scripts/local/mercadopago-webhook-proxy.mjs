// Expose this narrow listener to a temporary HTTPS tunnel, never Next/Supabase.
import http from "node:http";
const target = new URL(process.argv[2] || "http://127.0.0.1:3004");
if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))
  throw new Error("Local target required");
const path = "/api/payments/mercadopago/webhook";
http
  .createServer(async (request, response) => {
    const incoming = new URL(request.url || "/", "http://localhost");
    if (request.method !== "POST" || incoming.pathname !== path) {
      response.writeHead(404).end();
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 16_384) {
        response.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    try {
      const upstream = new URL(path, target);
      const id = incoming.searchParams.get("data.id");
      if (id) upstream.searchParams.set("data.id", id);
      const result = await fetch(upstream, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": request.headers["x-signature"] || "",
          "x-request-id": request.headers["x-request-id"] || "",
        },
        body: Buffer.concat(chunks),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      const responseText = await result.text();
      let errorCode;
      try {
        const parsed = JSON.parse(responseText);
        if (/^[a-z_]{1,80}$/.test(parsed.code || "")) errorCode = parsed.code;
      } catch {}
      response
        .writeHead(result.status, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        })
        .end(responseText);
      console.log(
        JSON.stringify({
          time: new Date().toISOString(),
          status: result.status,
          errorCode,
        }),
      );
    } catch {
      response.writeHead(503).end();
    }
  })
  .listen(64425, "127.0.0.1", () =>
    console.log("Webhook-only proxy listening on 127.0.0.1:64425"),
  );

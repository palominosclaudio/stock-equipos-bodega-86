import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const same = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async (req) => {
  const store = getStore({ name: "s086", consistency: "strong" });

  // Lectura pública: todos los que abren la página
  if (req.method === "GET") {
    const stock = await store.get("stock", { type: "json" });
    const offer = await store.get("offer", { type: "json" });
    return json({ stock, offer });
  }

  // Escritura: solo el administrador (clave en la variable ADMIN_KEY de Netlify)
  if (req.method === "POST") {
    const key = process.env.ADMIN_KEY;
    if (!key) return json({ error: "Falta configurar ADMIN_KEY en Netlify" }, 500);
    if (!same(req.headers.get("x-admin-key"), key)) return json({ error: "Clave incorrecta" }, 401);

    let b;
    try { b = await req.json(); } catch { return json({ error: "Datos inválidos" }, 400); }
    if ((b.kind !== "stock" && b.kind !== "offer") || !Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > 5000)
      return json({ error: "Datos inválidos" }, 400);

    const at = Date.now();
    const doc = b.kind === "stock"
      ? { rows: b.rows, fecha: String(b.fecha || ""), jor: String(b.jor || ""), carga: String(b.carga || ""), at }
      : { rows: b.rows, vig: String(b.vig || ""), at };
    await store.setJSON(b.kind, doc);
    return json({ ok: true, at });
  }

  return json({ error: "Método no permitido" }, 405);
};

export const config = { path: "/api/data" };

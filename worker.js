const COLECOES = new Set(["acoes", "pontos", "keyusers", "config", "meta"]);
const MAX_BODY = 900 * 1024; // linhas do D1 aceitam até ~2 MB; margem de segurança

let tabelaPronta = false;
async function garantirTabela(db) {
  if (tabelaPronta) return;
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS registros (colecao TEXT NOT NULL, id TEXT NOT NULL, dados TEXT NOT NULL, atualizado_em INTEGER NOT NULL, PRIMARY KEY (colecao, id))"
  ).run();
  tabelaPronta = true;
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      if (!env.DB) return json({ erro: "Binding D1 'DB' não configurado no Worker." }, 500);

      if (url.pathname === "/api/test-db") {
        const r = await env.DB.prepare("SELECT 1 AS teste").first();
        return json({ conectado: true, resultado: r });
      }

      const m = url.pathname.match(/^\/api\/data\/([^/]+)(?:\/([^/]+))?$/);
      if (!m) return json({ erro: "Rota não encontrada" }, 404);
      const colecao = decodeURIComponent(m[1]);
      const id = m[2] ? decodeURIComponent(m[2]) : null;
      if (!COLECOES.has(colecao)) return json({ erro: "Coleção inválida" }, 400);

      await garantirTabela(env.DB);

      if (request.method === "GET" && !id) {
        const { results } = await env.DB
          .prepare("SELECT id, dados FROM registros WHERE colecao = ? ORDER BY atualizado_em, id")
          .bind(colecao).all();
        return json(results.map(r => ({ id: r.id, data: JSON.parse(r.dados) })));
      }

      if (request.method === "PUT" && id) {
        const texto = await request.text();
        if (texto.length > MAX_BODY) return json({ erro: "Registro grande demais" }, 413);
        JSON.parse(texto); // valida
        await env.DB.prepare(
          "INSERT INTO registros (colecao, id, dados, atualizado_em) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(colecao, id) DO UPDATE SET dados = excluded.dados, atualizado_em = excluded.atualizado_em"
        ).bind(colecao, id, texto, Date.now()).run();
        return json({ ok: true });
      }

      if (request.method === "DELETE" && id) {
        await env.DB.prepare("DELETE FROM registros WHERE colecao = ? AND id = ?").bind(colecao, id).run();
        return new Response(null, { status: 204 });
      }

      return json({ erro: "Método não permitido" }, 405);
    } catch (e) {
      return json({ erro: String(e && e.message || e) }, 500);
    }
  },
};

O wrangler.jsonc é curto, então também deixo o conteúdo aqui, caso o download dele dê problema:

jsonc
{
  "$schema": "https://schema.cloudflare.com/wrangler.json",
  "name": "eficiencia-em-campo",
  "main": "worker.js",
  "compatibility_date": "2026-11-26",
  "assets": {
    "directory": "./",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "eficienciaemcampo",
      "database_id": "3baae03d-7737-4e13-9b08-6cb98c329dc4"
    }
  ]
}

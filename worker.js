export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/test-db") {
      try {
        const result = await env.DB.prepare("SELECT 1 AS teste").first();

        return Response.json({
          conectado: true,
          resultado: result
        });
      } catch (error) {
        return Response.json({
          conectado: false,
          erro: error.message
        }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};

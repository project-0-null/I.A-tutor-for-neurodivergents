/**
 * Cloudflare Pages Function — GET /api/health
 * Verifica a integridade da API e informa o modelo Gemini configurado.
 */
export async function onRequestGet(context) {
  const model = context.env.GEMINI_MODEL || "gemini-3.5-flash";
  return new Response(
    JSON.stringify({
      status: "healthy",
      model,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

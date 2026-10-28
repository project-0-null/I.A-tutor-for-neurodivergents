/**
 * Cloudflare Pages Function — GET /api/health
 * Verifica a integridade da API e informa o modelo Gemini configurado.
 */
export async function onRequestGet(context) {
  const model = context.env.GEMINI_MODEL || "gemini-3.5-flash";
  const rawKey = (context.env.GEMINI_API_KEY || "").trim();
  return new Response(
    JSON.stringify({
      status: "healthy",
      model,
      key_configured: Boolean(rawKey),
      key_suffix: rawKey ? rawKey.slice(-4) : null,
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

/**
 * Entry-point Cloudflare Worker + Static Assets
 * Roteia /api/chat e /api/health para as funções do backend e serve os arquivos estáticos.
 */
import { onRequestPost, onRequestOptions } from "./functions/api/chat.js";
import { onRequestGet } from "./functions/api/health.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      if (request.method === "GET") {
        return onRequestGet({ request, env, ctx });
      }
      return new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/chat") {
      if (request.method === "OPTIONS") {
        return onRequestOptions({ request, env, ctx });
      }
      if (request.method === "POST") {
        return onRequestPost({ request, env, ctx });
      }
      return new Response(JSON.stringify({ detail: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};

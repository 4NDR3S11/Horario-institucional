/**
 * Aplicativo CRUD: Horarios Docentes
 */
require('dotenv').config(); 
  
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const { pool } = require("./db");

const {
  sendJson,
  sendText,
  readJsonBody
} = require("./httpUtils");

const {
  validarHorario,
  sanitizarEntero,
  campoOrdenValido,
  CAMPOS_ORDEN_PERMITIDOS
} = require("./validation");

const {
  createHorario,
  updateHorario,
  deleteHorario,
  getHorarioById,
  getHorarios
} = require("./horariosRepository");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FRONT_DIR = path.join(PROJECT_ROOT, "front");

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js")   return "application/javascript; charset=utf-8";
  if (ext === ".css")  return "text/css; charset=utf-8";
  return "application/octet-stream";
}

async function serveStatic(req, res, pathname) {
  const target = pathname === "/" ? "/index.html" : pathname;
  const normalizedUrlPath = path.posix.normalize(target);
  const safeRelativePath = normalizedUrlPath.replace(/^\/+/, "");
  const filePath = path.resolve(FRONT_DIR, safeRelativePath);
  const relativeToFront = path.relative(FRONT_DIR, filePath);

  if (relativeToFront.startsWith("..") || path.isAbsolute(relativeToFront)) {
    sendText(res, 400, "Ruta inválida");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
  } catch {
    sendText(res, 404, "No encontrado");
  }
}

function parseIdFromPathname(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  if (!rest) return null;
  const parts = rest.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const n = Number(parts[0]);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function mapRepoError(err) {
  if (err && err.code === "NOT_FOUND")  return { statusCode: 404, message: err.message };
  if (err && err.code === "DUPLICADO")  return { statusCode: 409, message: err.message };
  return { statusCode: 500, message: "Error interno" };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");

  req.setTimeout(15000);

  const url      = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname;

  // ── FRONTEND ──────────────────────────────────────────────────────────────
  if (
    req.method === "GET" &&
    (pathname === "/" || pathname.endsWith(".html") ||
     pathname.endsWith(".js") || pathname.endsWith(".css"))
  ) {
    await serveStatic(req, res, pathname);
    return;
  }

  // ── HEALTH CHECK ──────────────────────────────────────────────────────────
  if (req.method === "GET" && pathname === "/api/health") {
    try {
      const conn = await pool.getConnection();
      try { await conn.query("SELECT 1"); } finally { conn.release(); }
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 500, { ok: false });
    }
    return;
  }

  // ── LISTAR HORARIOS ───────────────────────────────────────────────────────
  if (req.method === "GET" && pathname === "/api/horarios/list") {
    const orderBy = url.searchParams.get("orderBy") || "fechaClase";

    if (!campoOrdenValido(orderBy)) {
      sendJson(res, 400, { ok: false, error: `Campo de orden inválido. Permitidos: ${CAMPOS_ORDEN_PERMITIDOS.join(", ")}` });
      return;
    }

    try {
      const horarios = await getHorarios(orderBy, url.searchParams.get("q") || "");
      sendJson(res, 200, { ok: true, horarios });
    } catch (err) {
      const e = mapRepoError(err);
      sendJson(res, e.statusCode, { ok: false, error: e.message });
    }
    return;
  }

  // ── BUSCAR HORARIO POR ID ─────────────────────────────────────────────────
  if (req.method === "GET" && pathname === "/api/horarios/by-idHorario") {
    const id = sanitizarEntero(url.searchParams.get("idHorario"));

    if (!id) {
      sendJson(res, 400, { ok: false, error: "idHorario debe ser un entero positivo." });
      return;
    }

    try {
      const horario = await getHorarioById(id);
      if (!horario) {
        sendJson(res, 404, { ok: false, error: "Horario no encontrado" });
        return;
      }
      sendJson(res, 200, { ok: true, horario });
    } catch (err) {
      const e = mapRepoError(err);
      sendJson(res, e.statusCode, { ok: false, error: e.message });
    }
    return;
  }

  // ── CREAR HORARIO ─────────────────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/api/horarios") {
    let payload;
    try {
      payload = await readJsonBody(req, { maxBytes: 10000 });
    } catch (err) {
      sendJson(res, err.statusCode || 400, { ok: false, error: err.message });
      return;
    }

    const errores = validarHorario(payload || {});
    if (errores.length > 0) {
      sendJson(res, 400, { ok: false, error: "Validación falló", errores: errores });
      return;
    }

    try {
      const creado = await createHorario(payload);
      sendJson(res, 201, { ok: true, horario: creado });
    } catch (err) {
      const e = mapRepoError(err);
      sendJson(res, e.statusCode, { ok: false, error: e.message });
    }
    return;
  }

  // ── EDITAR HORARIO ────────────────────────────────────────────────────────
  const updateId = req.method === "PUT"
    ? parseIdFromPathname(pathname, "/api/horarios/")
    : null;

  if (req.method === "PUT" && updateId) {
    let payload;
    try {
      payload = await readJsonBody(req, { maxBytes: 10000 });
    } catch (err) {
      sendJson(res, err.statusCode || 400, { ok: false, error: err.message });
      return;
    }

    const errores = validarHorario(payload || {});
    if (errores.length > 0) {
      sendJson(res, 400, { ok: false, error: "Validación falló", errores: errores });
      return;
    }

    try {
      const actualizado = await updateHorario(updateId, payload);
      sendJson(res, 200, { ok: true, horario: actualizado });
    } catch (err) {
      const e = mapRepoError(err);
      sendJson(res, e.statusCode, { ok: false, error: e.message });
    }
    return;
  }

  // ── ELIMINAR HORARIO ──────────────────────────────────────────────────────
  if (req.method === "DELETE" && pathname === "/api/horarios/by-idHorario") {
    let payload;
    try {
      payload = await readJsonBody(req, { maxBytes: 3000 });
    } catch (err) {
      sendJson(res, err.statusCode || 400, { ok: false, error: err.message });
      return;
    }

    const id = sanitizarEntero(payload && payload.idHorario);
    if (!id) {
      sendJson(res, 400, { ok: false, error: "idHorario debe ser un entero positivo." });
      return;
    }

    try {
      const eliminado = await deleteHorario(id);
      sendJson(res, 200, { ok: true, horario: eliminado });
    } catch (err) {
      const e = mapRepoError(err);
      sendJson(res, e.statusCode, { ok: false, error: e.message });
    }
    return;
  }

  // ── VERIFICAR REPUTACIÓN DE CORREO ────────────────────────────────────────
  if (req.method === "GET" && pathname === "/api/email-reputacion") {
    const email = url.searchParams.get("email") || "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendJson(res, 400, { ok: false, error: "Correo inválido o no proporcionado." });
      return;
    }

    try {
      const apiKey = process.env.ABSTRACT_API_KEY || "";
      if (!apiKey) {
        sendJson(res, 500, { ok: false, error: "API key de Abstract no configurada. Define ABSTRACT_API_KEY en las variables de entorno." });
        return;
      }

      const apiUrl = `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`;
      const https = require("node:https");

      const resultado = await new Promise((resolve, reject) => {
        https.get(apiUrl, (apiRes) => {
          let data = "";
          apiRes.on("data", chunk => data += chunk);
          apiRes.on("end", () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error("Respuesta inválida de Abstract API")); }
          });
        }).on("error", reject);
      });

      sendJson(res, 200, { ok: true, resultado });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: "Error al consultar la API de reputación: " + err.message });
    }
    return;
  }

  sendText(res, 404, "No encontrado");
});

const PORT = 8080;

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Servidor iniciado en http://127.0.0.1:${PORT}/\n`);
});

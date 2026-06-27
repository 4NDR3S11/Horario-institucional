// back/rutas.horarios.js
// Rutas REST de la API — delegan la lógica al repositorio

"use strict";

const express = require("express");
const router  = express.Router();
const repo    = require("./repositorio.horarios");
const { sanitizarTexto, sanitizarEntero, validarHorario, campoOrdenValido } =
  require("./validaciones");

// ── GET /api/health ──────────────────────────────────────────────────────────
router.get("/health", async (req, res) => {
  try {
    const pool = require("./conexion");
    const conn = await pool.getConnection();
    conn.release();
    res.json({ estado: "ok", mensaje: "Servicio y base de datos operativos." });
  } catch {
    res.status(503).json({ estado: "error", mensaje: "Base de datos no disponible." });
  }
});

// ── GET /api/horarios/by-idHorario?idHorario=N ───────────────────────────────
router.get("/horarios/by-idHorario", async (req, res) => {
  try {
    const idHorario = sanitizarEntero(req.query.idHorario);
    if (!idHorario) return res.status(400).json({ error: "idHorario inválido." });

    const horario = await repo.getHorarioById(idHorario);
    if (!horario) return res.status(404).json({ error: "Horario No existe." });

    res.json({ horario });
  } catch {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /api/horarios/check?field=...&value=...&excludeIdHorario=... ─────────
router.get("/horarios/check", async (req, res) => {
  try {
    const CAMPOS_PERMITIDOS = ["docente", "materia", "carrera", "facultad"];
    const field     = sanitizarTexto(req.query.field   ?? "");
    const value     = sanitizarTexto(req.query.value   ?? "");
    const excludeId = sanitizarEntero(req.query.excludeIdHorario);

    if (!CAMPOS_PERMITIDOS.includes(field))
      return res.status(400).json({ error: "Campo de verificación no permitido." });
    if (!value)
      return res.status(400).json({ error: "El valor a verificar es obligatorio." });

    // Búsqueda directa usando getHorarios como base simple
    const pool = require("./conexion");
    const conn = await pool.getConnection();
    let sql = `SELECT idHorario FROM horarios_docentes WHERE ${field} = ?`;
    const params = [value];
    if (excludeId) { sql += " AND idHorario != ?"; params.push(excludeId); }
    const [filas] = await conn.execute(sql, params);
    conn.release();

    res.json({ existe: filas.length > 0 });
  } catch {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /api/horarios/list?orderBy=...&q=... ─────────────────────────────────
router.get("/horarios/list", async (req, res) => {
  try {
    const orderBy = sanitizarTexto(req.query.orderBy ?? "idHorario");
    const q       = sanitizarTexto(req.query.q       ?? "");

    if (!campoOrdenValido(orderBy))
      return res.status(400).json({ error: "Campo de orden no permitido." });

    const filas = await repo.getHorarios(orderBy, q);
    res.json({ horarios: filas, total: filas.length });
  } catch {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── GET /api/horarios/list-basic ──────────────────────────────────────────────
router.get("/horarios/list-basic", async (req, res) => {
  try {
    const filas = await repo.getHorarios();
    res.json({ horarios: filas, total: filas.length });
  } catch {
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── POST /api/horarios ────────────────────────────────────────────────────────
router.post("/horarios", async (req, res) => {
  try {
    const datos = {
      docente:          sanitizarTexto(req.body.docente          ?? ""),
      facultad:         sanitizarTexto(req.body.facultad         ?? ""),
      carrera:          sanitizarTexto(req.body.carrera          ?? ""),
      materia:          sanitizarTexto(req.body.materia          ?? ""),
      fechaClase:       sanitizarTexto(req.body.fechaClase       ?? ""),
      horaIniciaClase:  sanitizarTexto(req.body.horaIniciaClase  ?? ""),
      horaTerminaClase: sanitizarTexto(req.body.horaTerminaClase ?? ""),
    };

    const errores = validarHorario(datos);
    if (errores.length > 0) return res.status(422).json({ errores });

    const resultado = await repo.createHorario(datos);
    res.status(201).json({ mensaje: "Horario creado.", insertId: resultado.insertId });
  } catch (error) {
    if (error.code === "DUPLICADO")
      return res.status(409).json({ error: error.message });
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── PUT /api/horarios/:id ─────────────────────────────────────────────────────
router.put("/horarios/:id", async (req, res) => {
  try {
    const idHorario = sanitizarEntero(req.params.id);
    if (!idHorario) return res.status(400).json({ error: "ID inválido." });

    const datos = {
      docente:          sanitizarTexto(req.body.docente          ?? ""),
      facultad:         sanitizarTexto(req.body.facultad         ?? ""),
      carrera:          sanitizarTexto(req.body.carrera          ?? ""),
      materia:          sanitizarTexto(req.body.materia          ?? ""),
      fechaClase:       sanitizarTexto(req.body.fechaClase       ?? ""),
      horaIniciaClase:  sanitizarTexto(req.body.horaIniciaClase  ?? ""),
      horaTerminaClase: sanitizarTexto(req.body.horaTerminaClase ?? ""),
    };

    const errores = validarHorario(datos);
    if (errores.length > 0) return res.status(422).json({ errores });

    const resultado = await repo.updateHorario(idHorario, datos);
    res.json({ mensaje: "Horario editado.", filasAfectadas: resultado.filasAfectadas });
  } catch (error) {
    if (error.code === "NO_EXISTE")  return res.status(404).json({ error: error.message });
    if (error.code === "DUPLICADO")  return res.status(409).json({ error: error.message });
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// ── DELETE /api/horarios/by-idHorario ────────────────────────────────────────
router.delete("/horarios/by-idHorario", async (req, res) => {
  try {
    const idHorario = sanitizarEntero(req.body.idHorario);
    if (!idHorario) return res.status(400).json({ error: "idHorario inválido." });

    const resultado = await repo.deleteHorario(idHorario);
    res.json({ mensaje: "Horario borrado.", filasAfectadas: resultado.filasAfectadas });
  } catch (error) {
    if (error.code === "NO_EXISTE") return res.status(404).json({ error: error.message });
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

module.exports = router;

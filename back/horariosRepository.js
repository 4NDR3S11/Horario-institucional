/**
 * back/repositorio.horarios.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Repositorio de Horarios (CRUD) con:
 *  - Sentencias preparadas  → connection.execute(sql, [params])
 *  - Transacciones          → START TRANSACTION / COMMIT / ROLLBACK
 *  - Locks explícitos       → LOCK TABLES horarios_docentes WRITE / UNLOCK TABLES
 *
 * Vulnerabilidades mitigadas
 * ──────────────────────────
 * 1. SQL Injection
 *    Qué explota  : concatenación directa de strings en consultas SQL.
 *    Criticidad   : Alta / Crítica.
 *    Mitigación   : placeholders (?) + connection.execute() en TODAS las consultas.
 *
 * 2. TOCTOU / Condición de carrera en unicidad
 *    Qué explota  : validación previa a la escritura sin aislamiento transaccional.
 *    Criticidad   : Media.
 *    Mitigación   : LOCK TABLES ... WRITE envuelve validación + escritura,
 *                   garantizando atomicidad antes de insertar o actualizar.
 */

"use strict";

const { pool } = require('./db');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: liberar conexión con error dentro de transacción
// ─────────────────────────────────────────────────────────────────────────────
async function _liberarConError(conexion, error) {
  try {
    await conexion.query("UNLOCK TABLES");
    await conexion.rollback();
  } catch (_) { /* silenciar error secundario */ }
  finally { conexion.release(); }
  throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. OBTENER TODOS LOS HORARIOS  (con búsqueda y orden)
// ─────────────────────────────────────────────────────────────────────────────
async function getHorarios(orderBy = "idHorario", q = "") {
  const CAMPOS_ORDEN = ["idHorario", "docente", "materia", "facultad", "fechaClase"];
  const campoOrden = CAMPOS_ORDEN.includes(orderBy) ? orderBy : "idHorario";

  const conexion = await pool.getConnection();
  try {
    let sql = `
      SELECT idHorario, docente, facultad, carrera,
             materia, fechaClase, horaIniciaClase, horaTerminaClase
      FROM horarios_docentes
    `;
    const params = [];

    if (q && q.trim() !== "") {
      const termino = `%${q.trim()}%`;
      sql += `
        WHERE docente  LIKE ?
           OR materia  LIKE ?
           OR carrera  LIKE ?
           OR facultad LIKE ?
      `;
      params.push(termino, termino, termino, termino);
    }

    // campoOrden ya validado contra whitelist → seguro concatenar
    sql += ` ORDER BY ${campoOrden} ASC`;

    const [filas] = await conexion.execute(sql, params);
    return filas;
  } finally {
    conexion.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. OBTENER UN HORARIO POR ID
// ─────────────────────────────────────────────────────────────────────────────
async function getHorarioById(idHorario) {
  const conexion = await pool.getConnection();
  try {
    const sql = `
      SELECT idHorario, docente, facultad, carrera,
             materia, fechaClase, horaIniciaClase, horaTerminaClase
      FROM horarios_docentes
      WHERE idHorario = ?
      LIMIT 1
    `;
    const [filas] = await conexion.execute(sql, [idHorario]);
    return filas.length > 0 ? filas[0] : null;
  } finally {
    conexion.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CREAR UN HORARIO
// Flujo: START TRANSACTION → LOCK WRITE → CHECK duplicado → INSERT → UNLOCK → COMMIT
// ─────────────────────────────────────────────────────────────────────────────
async function createHorario(datos) {
  const { docente, facultad, carrera, materia,
          fechaClase, horaIniciaClase, horaTerminaClase } = datos;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query("LOCK TABLES horarios_docentes WRITE");

    // Verificar duplicado (TOCTOU mitigado por el lock)
    const sqlCheck = `
      SELECT idHorario FROM horarios_docentes
      WHERE docente = ? AND materia = ? AND carrera = ? AND fechaClase = ?
      LIMIT 1
    `;
    const [existentes] = await conexion.execute(sqlCheck,
      [docente, materia, carrera, fechaClase]);

    if (existentes.length > 0) {
      await conexion.query("UNLOCK TABLES");
      await conexion.rollback();
      conexion.release();
      const err = new Error("El horario ya existe para ese docente, materia, carrera y fecha.");
      err.code = "DUPLICADO";
      throw err;
    }

    const sqlInsert = `
      INSERT INTO horarios_docentes
        (docente, facultad, carrera, materia, fechaClase, horaIniciaClase, horaTerminaClase)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [resultado] = await conexion.execute(sqlInsert,
      [docente, facultad, carrera, materia, fechaClase, horaIniciaClase, horaTerminaClase]);

    await conexion.query("UNLOCK TABLES");
    await conexion.commit();
    conexion.release();

    return { insertId: resultado.insertId };
  } catch (error) {
    if (error.code === "DUPLICADO") throw error;
    await _liberarConError(conexion, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ACTUALIZAR UN HORARIO
// Flujo: START TRANSACTION → LOCK WRITE → CHECK existe → CHECK duplicado → UPDATE → UNLOCK → COMMIT
// ─────────────────────────────────────────────────────────────────────────────
async function updateHorario(idHorario, datos) {
  const { docente, facultad, carrera, materia,
          fechaClase, horaIniciaClase, horaTerminaClase } = datos;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query("LOCK TABLES horarios_docentes WRITE");

    // ¿Existe el registro?
    const sqlExiste = `SELECT idHorario FROM horarios_docentes WHERE idHorario = ? LIMIT 1`;
    const [existentes] = await conexion.execute(sqlExiste, [idHorario]);

    if (existentes.length === 0) {
      await conexion.query("UNLOCK TABLES");
      await conexion.rollback();
      conexion.release();
      const err = new Error(`Horario con id ${idHorario} no encontrado.`);
      err.code = "NO_EXISTE";
      throw err;
    }

    // ¿Colisiona con otro registro?
    const sqlCheck = `
      SELECT idHorario FROM horarios_docentes
      WHERE docente = ? AND materia = ? AND carrera = ? AND fechaClase = ?
        AND idHorario <> ?
      LIMIT 1
    `;
    const [duplicados] = await conexion.execute(sqlCheck,
      [docente, materia, carrera, fechaClase, idHorario]);

    if (duplicados.length > 0) {
      await conexion.query("UNLOCK TABLES");
      await conexion.rollback();
      conexion.release();
      const err = new Error("Ya existe otro horario con esa combinación.");
      err.code = "DUPLICADO";
      throw err;
    }

    const sqlUpdate = `
      UPDATE horarios_docentes
      SET docente = ?, facultad = ?, carrera = ?, materia = ?,
          fechaClase = ?, horaIniciaClase = ?, horaTerminaClase = ?
      WHERE idHorario = ?
    `;
    const [resultado] = await conexion.execute(sqlUpdate,
      [docente, facultad, carrera, materia, fechaClase,
       horaIniciaClase, horaTerminaClase, idHorario]);

    await conexion.query("UNLOCK TABLES");
    await conexion.commit();
    conexion.release();

    return { filasAfectadas: resultado.affectedRows };
  } catch (error) {
    if (error.code === "NO_EXISTE" || error.code === "DUPLICADO") throw error;
    await _liberarConError(conexion, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ELIMINAR UN HORARIO
// Flujo: START TRANSACTION → LOCK WRITE → CHECK existe → DELETE → UNLOCK → COMMIT
// ─────────────────────────────────────────────────────────────────────────────
async function deleteHorario(idHorario) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    await conexion.query("LOCK TABLES horarios_docentes WRITE");

    const sqlExiste = `SELECT idHorario FROM horarios_docentes WHERE idHorario = ? LIMIT 1`;
    const [filas] = await conexion.execute(sqlExiste, [idHorario]);

    if (filas.length === 0) {
      await conexion.query("UNLOCK TABLES");
      await conexion.rollback();
      conexion.release();
      const err = new Error(`Horario con id ${idHorario} no existe.`);
      err.code = "NO_EXISTE";
      throw err;
    }

    const sqlDelete = `DELETE FROM horarios_docentes WHERE idHorario = ?`;
    const [resultado] = await conexion.execute(sqlDelete, [idHorario]);

    await conexion.query("UNLOCK TABLES");
    await conexion.commit();
    conexion.release();

    return { filasAfectadas: resultado.affectedRows };
  } catch (error) {
    if (error.code === "NO_EXISTE") throw error;
    await _liberarConError(conexion, error);
  }
}

module.exports = { getHorarios, getHorarioById, createHorario, updateHorario, deleteHorario };

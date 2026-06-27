/**
 * front/app.js
 * SPA — Administración de Horarios CIAF
 * Solo HTML + JavaScript estricto, sin frameworks ni CSS externo.
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════
// DATOS: Facultades, Carreras y Materias de CIAF
// ═══════════════════════════════════════════════════════════════════

const DATOS_CIAF = {
  "Facultad de Administración": {
    "Administración de Empresas": [
      "Fundamentos de Administración",
      "Gestión del Talento Humano",
      "Gerencia Estratégica",
      "Mercadeo",
      "Legislación Comercial",
    ],
    "Negocios Internacionales": [
      "Comercio Exterior",
      "Logística Internacional",
      "Inglés para Negocios",
      "Finanzas Internacionales",
    ],
  },
  "Facultad de Finanzas y Contaduría": {
    "Contaduría Pública": [
      "Contabilidad General",
      "Contabilidad de Costos",
      "Auditoría",
      "Tributaria",
      "Contabilidad Financiera",
    ],
    "Tecnología en Gestión Financiera": [
      "Matemáticas Financieras",
      "Análisis Financiero",
      "Presupuestos",
      "Gestión de Riesgo",
    ],
  },
  "Facultad de Sistemas e Informática": {
    "Tecnología en Desarrollo de Software": [
      "Programación Web",
      "Bases de Datos",
      "Programación Orientada a Objetos",
      "Servicios Web",
      "Seguridad Informática",
    ],
    "Técnica en Redes y Telecomunicaciones": [
      "Redes de Computadores",
      "Telefonía IP",
      "Administración de Servidores",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════
// CONTROL DE VISTAS
// ═══════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// VERIFICACIÓN DE CORREO — Abstract Email Validation API
// ═══════════════════════════════════════════════════════════════════

const VISTAS = ["menu", "crear", "editar", "borrar", "listado", "email", "salir"];
let horarioCargadoEditar = false;
let horarioCargadoBorrar = false;

function mostrarVista(nombre) {
  VISTAS.forEach(v => {
    const el = document.getElementById("vista-" + v);
    if (el) el.style.display = (v === nombre) ? "block" : "none";
  });
  limpiarMensajes();

  if (nombre === "crear") {
    poblarFacultades("c-facultad");
    limpiarFormCrear();
  }
  if (nombre === "editar") {
    poblarFacultades("e-facultad");
    limpiarFormEditar();
  }
  if (nombre === "borrar") {
    limpiarFormBorrar();
  }
  if (nombre === "listado") cargarListado();
}

function limpiarMensajes() {
  ["msg-crear","msg-editar","msg-borrar"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; el.className = "area-msg"; }
  });
}

function mostrarMsg(idArea, texto, tipo) {
  const el = document.getElementById(idArea);
  if (!el) return;
  el.textContent = texto;
  el.className = "area-msg " + tipo;
}

// ═══════════════════════════════════════════════════════════════════
// SELECTS: FACULTADES, CARRERAS, MATERIAS
// ═══════════════════════════════════════════════════════════════════

function poblarFacultades(idSelect) {
  const sel = document.getElementById(idSelect);
  sel.innerHTML = '<option value="">— seleccione —</option>';
  for (const fac of Object.keys(DATOS_CIAF)) {
    const opt = document.createElement("option");
    opt.value = fac;
    opt.textContent = fac;
    sel.appendChild(opt);
  }
}

function actualizarCarreras(idFacultad, idCarrera, idMateria) {
  const facultad = document.getElementById(idFacultad).value;
  const selCarrera = document.getElementById(idCarrera);
  const selMateria = document.getElementById(idMateria);

  selCarrera.innerHTML = '<option value="">— seleccione —</option>';
  selMateria.innerHTML = '<option value="">— seleccione —</option>';

  if (!facultad || !DATOS_CIAF[facultad]) return;

  for (const carrera of Object.keys(DATOS_CIAF[facultad])) {
    const opt = document.createElement("option");
    opt.value = carrera;
    opt.textContent = carrera;
    selCarrera.appendChild(opt);
  }
}

function actualizarMaterias(idCarrera, idMateria) {
  const selCarrera = document.getElementById(idCarrera);
  const facultadId = idCarrera.replace("carrera", "facultad");
  const facultad   = document.getElementById(
    idCarrera.startsWith("c-") ? "c-facultad" : "e-facultad"
  ).value;
  const carrera = selCarrera.value;
  const selMateria = document.getElementById(idMateria);

  selMateria.innerHTML = '<option value="">— seleccione —</option>';
  if (!facultad || !carrera || !DATOS_CIAF[facultad] || !DATOS_CIAF[facultad][carrera]) return;

  for (const materia of DATOS_CIAF[facultad][carrera]) {
    const opt = document.createElement("option");
    opt.value = materia;
    opt.textContent = materia;
    selMateria.appendChild(opt);
  }
}

// ═══════════════════════════════════════════════════════════════════
// HELPER: URL base del backend
// Si el front se abre desde Live Server (puerto 5500) o cualquier
// otro origen, siempre apunta al servidor Express en el 8080.
// Si ya viene desde el 8080 (Express lo sirve), usa rutas relativas.
// ═══════════════════════════════════════════════════════════════════

const BASE_API = (function () {
  const puerto = parseInt(window.location.port, 10);
  if (puerto === 8080 || puerto === 0 || !puerto) {
    return ""; // Express lo sirve → rutas relativas funcionan
  }
  // Live Server u otro puerto → apuntar explícitamente al backend
  return "https://horario-institucional.onrender.com/";
})();

// ═══════════════════════════════════════════════════════════════════
// HELPER: llamadas a la API
// ═══════════════════════════════════════════════════════════════════

async function apiCall(metodo, url, cuerpo) {
  const urlCompleta = BASE_API + url;
  const opciones = {
    method: metodo,
    headers: { "Content-Type": "application/json" },
  };
  if (cuerpo) opciones.body = JSON.stringify(cuerpo);

  let resp;
  try {
    resp = await fetch(urlCompleta, opciones);
  } catch (err) {
    // Error de red: servidor apagado o CORS
    return {
      ok: false,
      status: 0,
      data: { error: "No se pudo conectar al servidor. Verifica que 'npm start' esté corriendo en el puerto 8080." },
    };
  }

  let data;
  try {
    data = await resp.json();
  } catch {
    data = { error: "Respuesta inesperada del servidor." };
  }

  return { ok: resp.ok, status: resp.status, data };
}

function sanitizarInput(valor) {
  return String(valor).trim().replace(/[<>"'`;]/g, "");
}

function deshabilitarBotones(ids, ms) {
  ids.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = true;
  });
  setTimeout(() => {
    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = false;
    });
  }, ms);
}

// ═══════════════════════════════════════════════════════════════════
// CREAR HORARIO
// ═══════════════════════════════════════════════════════════════════

function limpiarFormCrear() {
  ["c-docente","c-fecha","c-hinicia","c-htermina"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  poblarFacultades("c-facultad");
  document.getElementById("c-carrera").innerHTML = '<option value="">— seleccione —</option>';
  document.getElementById("c-materia").innerHTML = '<option value="">— seleccione —</option>';
  mostrarMsg("msg-crear", "", "");
}

async function guardarHorario() {
  const datos = {
    docente:          sanitizarInput(document.getElementById("c-docente").value),
    facultad:         sanitizarInput(document.getElementById("c-facultad").value),
    carrera:          sanitizarInput(document.getElementById("c-carrera").value),
    materia:          sanitizarInput(document.getElementById("c-materia").value),
    fechaClase:       sanitizarInput(document.getElementById("c-fecha").value),
    horaIniciaClase:  sanitizarInput(document.getElementById("c-hinicia").value),
    horaTerminaClase: sanitizarInput(document.getElementById("c-htermina").value),
  };

  // Validación front
  for (const v of Object.values(datos)) {
    if (!v) { mostrarMsg("msg-crear", "Debes completar los datos del formulario.", "error"); return; }
  }

  const { ok, status, data } = await apiCall("POST", "/api/horarios", datos);

  if (status === 409) { mostrarMsg("msg-crear", "El horario ya existe.", "error"); return; }
  if (!ok) {
    const msg = data.errores ? data.errores.join(" | ") : (data.error || "Error al guardar.");
    mostrarMsg("msg-crear", msg, "error");
    return;
  }

  mostrarMsg("msg-crear", "Registro creado.", "ok");
  deshabilitarBotones(["btn-guardar"], 1800);
  setTimeout(() => mostrarVista("menu"), 1800);
}

function cancelarVista(vista) {
  if (vista === "crear") limpiarFormCrear();
  if (vista === "editar") limpiarFormEditar();
  if (vista === "borrar") limpiarFormBorrar();
  mostrarVista("menu");
}

// ═══════════════════════════════════════════════════════════════════
// EDITAR HORARIO
// ═══════════════════════════════════════════════════════════════════

function limpiarFormEditar() {
  document.getElementById("e-id").value = "";
  document.getElementById("form-editar").style.display = "none";
  horarioCargadoEditar = false;
  mostrarMsg("msg-editar", "", "");
}

async function buscarParaEditar() {
  const idRaw = sanitizarInput(document.getElementById("e-id").value);
  if (!idRaw || isNaN(idRaw) || parseInt(idRaw) <= 0) {
    mostrarMsg("msg-editar", "Debe digitar el ID a buscar.", "error"); return;
  }

  const { ok, status, data } = await apiCall("GET", `/api/horarios/by-idHorario?idHorario=${idRaw}`);

  if (status === 404) { mostrarMsg("msg-editar", "El horario no existe.", "error"); return; }
  if (!ok) { mostrarMsg("msg-editar", data.error || "Error al buscar.", "error"); return; }

  const h = data.horario;
  poblarFacultades("e-facultad");
  document.getElementById("e-facultad").value = h.facultad;
  actualizarCarreras("e-facultad", "e-carrera", "e-materia");
  document.getElementById("e-carrera").value = h.carrera;
  actualizarMaterias("e-carrera", "e-materia");
  document.getElementById("e-materia").value = h.materia;
  document.getElementById("e-docente").value  = h.docente;
  document.getElementById("e-fecha").value    = h.fechaClase ? h.fechaClase.substring(0,10) : "";
  document.getElementById("e-hinicia").value  = h.horaIniciaClase  || "";
  document.getElementById("e-htermina").value = h.horaTerminaClase || "";

  document.getElementById("form-editar").style.display = "block";
  horarioCargadoEditar = true;
  mostrarMsg("msg-editar", "Horario cargado.", "ok");
}

async function editarHorario() {
  if (!horarioCargadoEditar) {
    mostrarMsg("msg-editar", "Debe buscar un horario existente para editar.", "error"); return;
  }

  const idRaw = sanitizarInput(document.getElementById("e-id").value);
  const datos = {
    docente:          sanitizarInput(document.getElementById("e-docente").value),
    facultad:         sanitizarInput(document.getElementById("e-facultad").value),
    carrera:          sanitizarInput(document.getElementById("e-carrera").value),
    materia:          sanitizarInput(document.getElementById("e-materia").value),
    fechaClase:       sanitizarInput(document.getElementById("e-fecha").value),
    horaIniciaClase:  sanitizarInput(document.getElementById("e-hinicia").value),
    horaTerminaClase: sanitizarInput(document.getElementById("e-htermina").value),
  };

  for (const v of Object.values(datos)) {
    if (!v) { mostrarMsg("msg-editar", "Debes completar los datos del formulario.", "error"); return; }
  }

  if (!confirm("¿Está seguro de Editar el registro?")) {
    limpiarFormEditar(); return;
  }

  const { ok, status, data } = await apiCall("PUT", `/api/horarios/${idRaw}`, datos);

  if (status === 404) { mostrarMsg("msg-editar", "El horario no existe.", "error"); return; }
  if (status === 409) { mostrarMsg("msg-editar", "El horario ya existe.", "error"); return; }
  if (!ok) {
    const msg = data.errores ? data.errores.join(" | ") : (data.error || "Error al editar.");
    mostrarMsg("msg-editar", msg, "error"); return;
  }

  mostrarMsg("msg-editar", "Horario editado.", "ok");
  deshabilitarBotones(["btn-editar"], 1800);
  setTimeout(() => limpiarFormEditar(), 1800);
}

// ═══════════════════════════════════════════════════════════════════
// BORRAR HORARIO
// ═══════════════════════════════════════════════════════════════════

function limpiarFormBorrar() {
  document.getElementById("b-id").value = "";
  document.getElementById("form-borrar").style.display = "none";
  ["b-docente","b-facultad","b-carrera","b-materia","b-fecha","b-hinicia","b-htermina"]
    .forEach(id => { document.getElementById(id).value = ""; });
  horarioCargadoBorrar = false;
  mostrarMsg("msg-borrar", "", "");
}

async function buscarParaBorrar() {
  const idRaw = sanitizarInput(document.getElementById("b-id").value);
  if (!idRaw || isNaN(idRaw) || parseInt(idRaw) <= 0) {
    mostrarMsg("msg-borrar", "Debe digitar el ID a buscar.", "error"); return;
  }

  const { ok, status, data } = await apiCall("GET", `/api/horarios/by-idHorario?idHorario=${idRaw}`);
  if (status === 404) { mostrarMsg("msg-borrar", "El horario no existe.", "error"); return; }
  if (!ok) { mostrarMsg("msg-borrar", data.error || "Error al buscar.", "error"); return; }

  const h = data.horario;
  document.getElementById("b-docente").value  = h.docente;
  document.getElementById("b-facultad").value = h.facultad;
  document.getElementById("b-carrera").value  = h.carrera;
  document.getElementById("b-materia").value  = h.materia;
  document.getElementById("b-fecha").value    = h.fechaClase ? h.fechaClase.substring(0,10) : "";
  document.getElementById("b-hinicia").value  = h.horaIniciaClase  || "";
  document.getElementById("b-htermina").value = h.horaTerminaClase || "";

  document.getElementById("form-borrar").style.display = "block";
  horarioCargadoBorrar = true;
  mostrarMsg("msg-borrar", "Horario cargado.", "ok");
}

async function eliminarHorario() {
  const idRaw = sanitizarInput(document.getElementById("b-id").value);

  if (!idRaw) {
    mostrarMsg("msg-borrar", "El Horario no puede estar vacío.", "error"); return;
  }
  if (!horarioCargadoBorrar) {
    mostrarMsg("msg-borrar", "Debe buscar una identificación existente antes de eliminar.", "error"); return;
  }
  if (!confirm("¿Está seguro de Borrar el registro?")) {
    limpiarFormBorrar(); return;
  }

  const { ok, status, data } = await apiCall("DELETE", "/api/horarios/by-idHorario", { idHorario: parseInt(idRaw) });

  if (status === 404) { mostrarMsg("msg-borrar", "El horario no existe.", "error"); return; }
  if (!ok) { mostrarMsg("msg-borrar", data.error || "Error al borrar.", "error"); return; }

  mostrarMsg("msg-borrar", "Horario borrado.", "ok");
  deshabilitarBotones(["btn-eliminar"], 1800);
  setTimeout(() => limpiarFormBorrar(), 1800);
}

// ═══════════════════════════════════════════════════════════════════
// LISTADO
// ═══════════════════════════════════════════════════════════════════

async function cargarListado() {
  mostrarVista("listado");
  buscarListado();
}

async function buscarListado() {
  const orden   = sanitizarInput(document.getElementById("l-orden").value);
  const q       = sanitizarInput(document.getElementById("l-q").value);
  const tbody   = document.getElementById("tbody-listado");
  const resumen = document.getElementById("resumen-listado");
  const btnBuscar = document.getElementById("btn-buscar-listado");
  const selOrden  = document.getElementById("l-orden");
  const inputQ    = document.getElementById("l-q");

  // Deshabilitar controles durante carga
  [btnBuscar, selOrden, inputQ].forEach(el => el.disabled = true);
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1rem;color:#888;">Cargando...</td></tr>';
  resumen.textContent = "";

  const { ok, data } = await apiCall("GET", `/api/horarios/list?orderBy=${encodeURIComponent(orden)}&q=${encodeURIComponent(q)}`);

  [btnBuscar, selOrden, inputQ].forEach(el => el.disabled = false);

  if (!ok) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#b00;padding:1rem;">${data.error || "Error al cargar."}</td></tr>`;
    return;
  }

  const horarios = data.horarios || [];
  resumen.textContent = `Registros: ${horarios.length}`;

  if (horarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1rem;color:#888;">Sin resultados.</td></tr>';
    return;
  }

  tbody.innerHTML = horarios.map(h => `
    <tr>
      <td>${h.idHorario}</td>
      <td>${h.docente}</td>
      <td>${h.facultad}</td>
      <td>${h.carrera}</td>
      <td>${h.materia}</td>
      <td>${h.fechaClase ? String(h.fechaClase).substring(0,10) : ""}</td>
      <td>${h.horaIniciaClase  || ""}</td>
      <td>${h.horaTerminaClase || ""}</td>
    </tr>
  `).join("");
}

async function verificarCorreo() {
  const correo = (document.getElementById("em-correo").value || "").trim();
  const msgEl = document.getElementById("msg-email");
  const resultadoDiv = document.getElementById("resultado-email");
  const tbody = document.getElementById("tbody-email");
  const btn = document.getElementById("btn-verificar");

  resultadoDiv.style.display = "none";
  msgEl.style.display = "none";
  msgEl.textContent = "";

  if (!correo) {
    msgEl.textContent = "Por favor ingresa un correo electrónico.";
    msgEl.className = "mensaje error";
    msgEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Verificando...";

  try {
    const res = await fetch(`/api/email-reputacion?email=${encodeURIComponent(correo)}`);
    const data = await res.json();

    if (!data.ok) {
      msgEl.textContent = data.error || "Error al verificar el correo.";
      msgEl.className = "mensaje error";
      msgEl.style.display = "block";
      return;
    }

    const r = data.resultado;

    const calidad = r.quality_score != null
      ? (parseFloat(r.quality_score) * 100).toFixed(0) + "%"
      : "N/A";

    const filas = [
      ["Correo",              r.email || correo],
      ["Formato válido",      r.is_valid_format?.value       ? "✅ Sí" : "❌ No"],
      ["MX registrado",       r.is_mx_found?.value           ? "✅ Sí" : "❌ No"],
      ["SMTP válido",         r.is_smtp_valid?.value         ? "✅ Sí" : "❌ No"],
      ["Correo temporal",     r.is_disposable_email?.value   ? "⚠️ Sí (temporal)" : "✅ No"],
      ["Rol (no personal)",   r.is_role_email?.value         ? "⚠️ Sí (ej: info@)" : "✅ No"],
      ["Posible typo",        r.is_catchall_email?.value     ? "⚠️ Catch-all" : "✅ No"],
      ["Entregable",          r.deliverability || "N/A"],
      ["Puntuación calidad",  calidad],
    ];

    tbody.innerHTML = filas.map(([campo, valor]) =>
      `<tr><td><strong>${campo}</strong></td><td>${valor}</td></tr>`
    ).join("");

    resultadoDiv.style.display = "block";
    msgEl.textContent = "Verificación completada.";
    msgEl.className = "mensaje ok";
    msgEl.style.display = "block";

  } catch (err) {
    msgEl.textContent = "Error de red al consultar la API.";
    msgEl.className = "mensaje error";
    msgEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Verificar";
  }
}

// ═══════════════════════════════════════════════════════════════════
// INICIO: mostrar menú por defecto
// ═══════════════════════════════════════════════════════════════════
mostrarVista("menu");

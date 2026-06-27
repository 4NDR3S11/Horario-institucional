// back/validaciones.js
// Sanitización y validación de datos del formulario de horarios

"use strict";

const CAMPOS_ORDEN_PERMITIDOS = ["idHorario", "docente", "materia", "facultad", "fechaClase"];

function sanitizarTexto(valor) {
  if (typeof valor !== "string") return "";
  return valor.trim().replace(/[<>"'`;]/g, "");
}

function sanitizarEntero(valor) {
  const num = parseInt(valor, 10);
  return isNaN(num) || num <= 0 ? null : num;
}

function validarHorario(datos) {
  const errores = [];
  const campos = [
    { clave: "docente",          etiqueta: "Docente" },
    { clave: "facultad",         etiqueta: "Facultad" },
    { clave: "carrera",          etiqueta: "Carrera" },
    { clave: "materia",          etiqueta: "Materia" },
    { clave: "fechaClase",       etiqueta: "Fecha de clase" },
    { clave: "horaIniciaClase",  etiqueta: "Hora de inicio" },
    { clave: "horaTerminaClase", etiqueta: "Hora de termina" },
  ];

  for (const campo of campos) {
    const val = sanitizarTexto(datos[campo.clave] ?? "");
    if (!val) errores.push(`${campo.etiqueta} es obligatorio.`);
  }

  if (datos.horaIniciaClase && datos.horaTerminaClase) {
    if (datos.horaIniciaClase.trim() >= datos.horaTerminaClase.trim()) {
      errores.push("La hora de inicio debe ser anterior a la hora de termina.");
    }
  }

  return errores;
}

function campoOrdenValido(campo) {
  return CAMPOS_ORDEN_PERMITIDOS.includes(campo);
}

module.exports = {
  sanitizarTexto,
  sanitizarEntero,
  validarHorario,
  campoOrdenValido,
  CAMPOS_ORDEN_PERMITIDOS,
};

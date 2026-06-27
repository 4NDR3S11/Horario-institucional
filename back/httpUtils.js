/**
 * Utilidades HTTP (sin frameworks).
 *
 * Seguridad:
 * - Límite de tamaño del body JSON para mitigar DoS básico por payloads grandes.
 * - Respuestas de error sanitizadas para no filtrar detalles internos.
 */

const { StringDecoder } = require("node:string_decoder"); // Importa un decoder UTF-8 para convertir chunks (Buffer) a string sin romper caracteres multibyte.

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data); // Serializa el objeto a JSON; evita concatenación manual y asegura formato estándar.
  res.writeHead(statusCode, { // Envía status y headers antes del body.
    "Content-Type": "application/json; charset=utf-8", // Declara JSON en UTF-8 para interoperabilidad.
    "Cache-Control": "no-store", // Evita cache: reduce exposición de datos y facilita desarrollo.
    "Content-Length": Buffer.byteLength(body) // Envía longitud exacta en bytes para que el cliente sepa cuándo termina el body.
  }); // Seguridad: no se incluyen headers peligrosos; se controla el tipo explícitamente.
  res.end(body); // Finaliza la respuesta HTTP enviando el JSON.
}

function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, { // Envía status y headers para respuesta de texto.
    "Content-Type": contentType, // Permite variar el MIME (por defecto text/plain en UTF-8).
    "Cache-Control": "no-store", // Evita cacheo para respuestas dinámicas o de error.
    "Content-Length": Buffer.byteLength(text) // Define el tamaño del body para lectura correcta del lado cliente.
  });
  res.end(text); // Envía el texto y cierra la respuesta.
}

function readJsonBody(req, { maxBytes }) {
  return new Promise((resolve, reject) => { // Envuelve el flujo de eventos (stream) en una Promesa para usar await en handlers.
    const decoder = new StringDecoder("utf8"); // Inicializa decoder para convertir buffers a string de forma incremental.
    let total = 0; // Acumula bytes recibidos para aplicar el límite de tamaño.
    let raw = ""; // Acumula el body como string para luego parsearlo como JSON.

    req.on("data", (chunk) => {
      total += chunk.length; // Suma el tamaño del chunk recibido.
      if (total > maxBytes) {
        reject(Object.assign(new Error("Payload demasiado grande"), { statusCode: 413 })); // 413 Payload Too Large para indicar límite excedido.
        req.destroy(); // Corta la conexión para frenar la recepción de más datos (mitigación DoS por payload grande).
        return; // Sale del handler de "data" para no seguir concatenando.
      }
      raw += decoder.write(chunk); // Decodifica y concatena el chunk respetando caracteres multibyte.
    });

    req.on("end", () => {
      raw += decoder.end(); // Completa el decoding (puede devolver bytes pendientes en el buffer interno del decoder).
      if (!raw) {
        resolve(null); // Body vacío: se interpreta como ausencia de payload (útil para endpoints que no requieren body).
        return; // Termina el handler para no intentar JSON.parse.
      }
      try {
        const parsed = JSON.parse(raw); // Parsea JSON; si es inválido, lanzará excepción.
        resolve(parsed); // Resuelve la Promesa con el objeto/valor parseado.
      } catch {
        reject(Object.assign(new Error("JSON inválido"), { statusCode: 400 })); // 400 Bad Request: el cliente envió JSON mal formado.
      }
    });

    req.on("error", reject); // Propaga errores de stream a la Promesa para manejarlos en el endpoint.
  });
}

module.exports = {
  sendJson, // Exporta helper para respuestas JSON.
  sendText, // Exporta helper para respuestas de texto.
  readJsonBody // Exporta helper para lectura/parsing seguro de body JSON.
};

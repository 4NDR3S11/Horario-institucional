/**
 * Configuración de conexión MySQL (solo para el backend).
 *
 * Seguridad:
 * - No exponer estas credenciales al frontend.
 * - En un entorno real se recomienda usar variables de entorno (no hardcodear secretos).
 *
 * Nota SSL:
 * - En MySQL local, el uso real de TLS puede variar por configuración del servidor.
 * - El parámetro `ssl` se deja configurado para intentar TLS; si tu servidor no lo requiere, se puede ajustar.
 */

const host = process.env.DB_HOST || "127.0.0.1"; // Host del servidor MySQL; se permite override con variable de entorno para no hardcodear valores.
const portRaw = process.env.DB_PORT; // Valor crudo (string) del puerto tomado desde el entorno.
const port = portRaw && Number.isInteger(Number(portRaw)) ? Number(portRaw) : 3306; // Convierte a número entero seguro; si no es válido, usa 3306 (default MySQL).
const user = process.env.DB_USER || "root"; // Usuario de BD; parametrizable para distintos entornos (dev/test/prod).
const password = process.env.DB_PASSWORD || "d46368389"; // Vulnerabilidad: Use of Hard-coded Credentials (CWE-798), explota fuga de repositorio/logs; criticidad Crítica (CVSS ~9.8); mitigación aplicada: soporte de variables de entorno para reemplazar el secreto sin tocar código (en producción debe eliminarse el fallback).
const database = process.env.DB_NAME || "horariosdocentes"; // Nombre de la base de datos; parametrizable para separar ambientes.

const sslEnabled = String(process.env.DB_SSL || "true").toLowerCase() !== "false"; // Feature flag simple: permite desactivar TLS en entornos locales que no lo soporten.
const ssl = sslEnabled
  ? {
      rejectUnauthorized: false, // En laboratorios suele usarse CA propia o sin CA; en producción debe ser true con CA válida.
      minVersion: "TLSv1.2", // Fuerza un mínimo criptográfico razonable (evita TLS 1.0/1.1).
      ciphers: "TLS_AES_128_GCM_SHA256" // Selecciona un conjunto de cifrado moderno (puede variar según OpenSSL/servidor MySQL).
    }
  : undefined; // Si se desactiva TLS por variable de entorno, no se envía configuración SSL al driver.

module.exports = {
  host, // Exporta el host final calculado.
  port, // Exporta el puerto final calculado.
  user, // Exporta el usuario final calculado.
  password, // Exporta la contraseña final (de entorno o vacía).
  database, // Exporta el nombre de base de datos final.
  ssl // Exporta configuración TLS si aplica.
};

/**
 * Capa de acceso a base de datos (pool MySQL).
 *
 * Seguridad:
 * - Pool en backend (Node.js). El frontend nunca se conecta directo a MySQL.
 * - Todas las operaciones deben usar sentencias preparadas (connection.execute).
 */

const mysql = require("mysql2/promise"); // Importa el driver mysql2 en modo Promesas para usar async/await en las consultas.
const dbConfig = require("../variables/dbConfig"); // Carga la configuración de conexión desde un módulo centralizado (idealmente parametrizado por entorno).

const pool = mysql.createPool({ // Crea un pool de conexiones para reutilizar sockets y reducir latencia/costo de conexión.
  host: dbConfig.host, // Host del servidor MySQL.
  port: dbConfig.port, // Puerto TCP de MySQL (default 3306).
  user: dbConfig.user, // Usuario con privilegios mínimos necesarios para operar la tabla.
  password: dbConfig.password, // Contraseña del usuario (idealmente provista por variables de entorno; evita hardcoding).
  database: dbConfig.database, // Base de datos a usar por defecto en la conexión.
  ssl: dbConfig.ssl, // Parámetros TLS (si aplica) para proteger credenciales/datos en tránsito.
  connectionLimit: 10, // Máximo de conexiones simultáneas en el pool para evitar saturación del servidor.
  waitForConnections: true, // Si el pool se llena, encola solicitudes en vez de fallar inmediatamente.
  queueLimit: 0, // 0 = sin límite de cola; útil en laboratorios, pero en producción conviene limitar para evitar DoS por acumulación.
  namedPlaceholders: false // Usa placeholders posicionales "?" en vez de ":name" para simplificar el SQL en este proyecto.
}); // Vulnerabilidad potencial: DoS por agotamiento de conexiones; criticidad Media (CVSS ~6.5) si público; mitigación: connectionLimit + timeouts en el servidor HTTP.

module.exports = { pool }; // Exporta el pool para que el resto del backend obtenga conexiones de forma consistente.
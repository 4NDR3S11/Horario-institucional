CREATE DATABASE IF NOT EXISTS `horariosdocentes` -- Crea la base de datos si no existe; evita error al re-ejecutar el script (idempotencia).
  CHARACTER SET utf8mb4 -- Define charset utf8mb4 para soportar todo Unicode (incluye emojis y caracteres extendidos).
  COLLATE utf8mb4_0900_ai_ci; -- Collation: comparaciones case-insensitive y acento-insensitive según configuración 0900 (MySQL 8).

USE `horariosdocentes`; -- Selecciona la base para que las instrucciones siguientes se apliquen ahí.

CREATE TABLE IF NOT EXISTS `horarios_docentes` ( -- Crea la tabla principal si no existe; permite re-ejecutar el script sin fallar.
  `idHorario` int PRIMARY KEY NOT NULL AUTO_INCREMENT, -- PK surrogate; AUTO_INCREMENT genera IDs únicos sin depender de la identificación real.
  `docente` varchar(100) NOT NULL, -- Identificación del cliente; se valida en backend y se usa como clave de negocio.
  `facultad` varchar(100) NOT NULL, -- Nombre; longitud limitada para evitar almacenamiento excesivo y alinear con validación.
  `carrera` varchar(100) NOT NULL, -- Ciudad; límite de longitud.
  `materia` varchar(100) NOT NULL, -- Dirección; límite de longitud.
  `fechaClase` date NOT NULL, 
  `horaIniciaClase` time NOT NULL, -- Email; longitud limitada.
  `horaTerminaClase` time NOT NULL, -- Auditoría: fecha/hora de creación automática.
  PRIMARY KEY (`idHorario`), -- Define la llave primaria para indexar y garantizar unicidad del id.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci; -- InnoDB: transacciones/locks; charset/collation coherentes con la BD.

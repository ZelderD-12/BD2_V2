-- Fix LogUsuario column nullability for error logging
-- usuario_ejecutor and usuario_afectado_id must allow NULL
-- because error-path INSERTs may not have a user ID

ALTER TABLE dbo.LogUsuario ALTER COLUMN usuario_ejecutor SMALLINT NULL;
ALTER TABLE dbo.LogUsuario ALTER COLUMN usuario_afectado_id SMALLINT NULL;

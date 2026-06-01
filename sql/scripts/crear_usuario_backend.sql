-- ============================================================
-- Crear usuario exclusivo para el backend
-- Permisos minimos necesarios:
--   EXECUTE              → llamar SPs
--   SELECT, UPDATE Cita  → auto-expiracion de citas vencidas
-- ============================================================

-- 1. Login a nivel servidor
CREATE LOGIN clinica_backend WITH PASSWORD = 'BackendPF2026$';

-- 2. Usuario en la BD
USE ClinicaF;
CREATE USER clinica_backend FOR LOGIN clinica_backend;

-- 3. Permisos minimos
GRANT EXECUTE TO clinica_backend;
GRANT SELECT, UPDATE ON dbo.Cita TO clinica_backend;

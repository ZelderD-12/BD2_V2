-- ============================================================
-- METABASE — 10 Consultas para Dashboards
-- Base de datos: ClinicaF (SQL Server)
-- ============================================================

-- ============================================================
-- 1. Espera promedio por sede y por hora
-- ============================================================
-- Tiempo promedio entre generacion del ticket y llamado
SELECT
    s.nombre AS sede,
    DATEPART(HOUR, t.fecha_generacion) AS hora,
    AVG(DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_llamado)) AS espera_promedio_min
FROM Ticket t
JOIN Sede s ON t.id_sede = s.id_sede
WHERE t.fecha_llamado IS NOT NULL
GROUP BY s.nombre, DATEPART(HOUR, t.fecha_generacion)
ORDER BY s.nombre, hora;

-- ============================================================
-- 2. SLA% por medico y especialidad
-- ============================================================
-- SLA = atendidos dentro de 30 min desde generacion del ticket
SELECT
    u.nombres + ' ' + u.apellidos AS medico,
    e.Nombre_Especialidad AS especialidad,
    COUNT(*) AS total_atendidos,
    SUM(CASE WHEN DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_llamado) <= 30 THEN 1 ELSE 0 END) AS dentro_sla,
    ROUND(100.0 *
        SUM(CASE WHEN DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_llamado) <= 30 THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0), 1) AS sla_pct
FROM Ticket t
JOIN Cita c ON t.id_cita = c.id_cita
JOIN Usuario u ON c.id_medico = u.id_usuario
JOIN Servicio sv ON t.id_servicio = sv.id_servicio
JOIN Especialidad e ON sv.id_especialidad = e.id_especialidad
WHERE t.id_estado_ticket IN (3, 4) -- EN_ATENCION o FINALIZADO
GROUP BY u.nombres, u.apellidos, e.Nombre_Especialidad
ORDER BY especialidad, medico;

-- ============================================================
-- 3. No-show por dia/hora y por sede
-- ============================================================
SELECT
    DATENAME(WEEKDAY, c.fecha_inicio) AS dia_semana,
    DATEPART(HOUR, c.fecha_inicio) AS hora,
    s.nombre AS sede,
    COUNT(*) AS total_citas,
    SUM(CASE WHEN c.id_estado_cita = 6 THEN 1 ELSE 0 END) AS noshow,
    ROUND(100.0 *
        SUM(CASE WHEN c.id_estado_cita = 6 THEN 1 ELSE 0 END)
        / NULLIF(COUNT(*), 0), 1) AS noshow_pct
FROM Cita c
JOIN Sede s ON c.id_sede = s.id_sede
WHERE c.id_estado_cita IN (4, 6, 8) -- Cancelada, No_Show, Atendida
GROUP BY DATENAME(WEEKDAY, c.fecha_inicio), DATEPART(HOUR, c.fecha_inicio), s.nombre
ORDER BY sede, dia_semana, hora;

-- ============================================================
-- 4. Top diagnosticos por mes
-- ============================================================
SELECT
    YEAR(h.fecha_atencion) AS anio,
    MONTH(h.fecha_atencion) AS mes,
    h.diagnostico,
    COUNT(*) AS total
FROM HistorialClinico h
WHERE h.diagnostico IS NOT NULL AND h.diagnostico != ''
GROUP BY YEAR(h.fecha_atencion), MONTH(h.fecha_atencion), h.diagnostico
ORDER BY anio DESC, mes DESC, total DESC;

-- ============================================================
-- 5. Top medicamentos por especialidad
-- ============================================================
SELECT
    e.Nombre_Especialidad AS especialidad,
    m.nombre AS medicamento,
    COUNT(*) AS total_recetado
FROM Receta_Detalle rd
JOIN Receta r ON rd.id_receta = r.id_receta
JOIN Cita c ON r.id_cita = c.id_cita
JOIN Servicio sv ON c.id_servicio = sv.id_servicio
JOIN Especialidad e ON sv.id_especialidad = e.id_especialidad
JOIN Medicamento m ON rd.id_medicamento = m.id_medicamento
GROUP BY e.Nombre_Especialidad, m.nombre
ORDER BY especialidad, total_recetado DESC;

-- ============================================================
-- 6. Demanda: citas solicitadas vs atendidas
-- ============================================================
SELECT
    CAST(c.fecha_solicitud AS DATE) AS fecha,
    COUNT(*) AS solicitadas,
    SUM(CASE WHEN c.id_estado_cita = 8 THEN 1 ELSE 0 END) AS atendidas
FROM Cita c
WHERE c.fecha_solicitud IS NOT NULL
GROUP BY CAST(c.fecha_solicitud AS DATE)
ORDER BY fecha;

-- ============================================================
-- 7. Productividad: pacientes/hora por medico
-- ============================================================
SELECT
    u.nombres + ' ' + u.apellidos AS medico,
    COUNT(DISTINCT c.id_cita) AS total_pacientes,
    ROUND(SUM(DATEDIFF(MINUTE, c.fecha_inicio, c.fecha_fin)) / 60.0, 1) AS horas_trabajadas,
    ROUND(COUNT(DISTINCT c.id_cita)
        / NULLIF(SUM(DATEDIFF(MINUTE, c.fecha_inicio, c.fecha_fin)) / 60.0, 0), 1) AS pacientes_por_hora
FROM Cita c
JOIN Usuario u ON c.id_medico = u.id_usuario
WHERE c.id_estado_cita = 8 -- Atendida
  AND c.fecha_fin IS NOT NULL
GROUP BY u.nombres, u.apellidos
ORDER BY pacientes_por_hora DESC;

-- ============================================================
-- 8. Distribucion de prioridades y fairness
-- ============================================================
SELECT
    t.prioridad,
    COUNT(*) AS total,
    AVG(DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_llamado)) AS espera_promedio_min,
    MIN(DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_llamado)) AS espera_min_min,
    MAX(DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_llamado)) AS espera_max_min,
    -- Fairness: desviacion estandar (menor = mas justo)
    ROUND(STDEV(DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_llamado)), 1) AS desviacion_estandar
FROM Ticket t
WHERE t.fecha_llamado IS NOT NULL
GROUP BY t.prioridad
ORDER BY t.prioridad;

-- ============================================================
-- 9. Backlog (tickets en cola) por servicio
-- ============================================================
SELECT
    sv.Nombre_Servicio AS servicio,
    COUNT(*) AS en_cola,
    MIN(DATEDIFF(MINUTE, t.fecha_generacion, GETDATE())) AS espera_min_min,
    AVG(DATEDIFF(MINUTE, t.fecha_generacion, GETDATE())) AS espera_promedio_min,
    MAX(DATEDIFF(MINUTE, t.fecha_generacion, GETDATE())) AS espera_max_min
FROM Ticket t
JOIN Servicio sv ON t.id_servicio = sv.id_servicio
WHERE t.id_estado_ticket = 1 -- EN_ESPERA
GROUP BY sv.Nombre_Servicio
ORDER BY en_cola DESC;

-- ============================================================
-- 10. Tiempos de atencion promedio por servicio
-- ============================================================
SELECT
    sv.Nombre_Servicio AS servicio,
    AVG(DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_llamado)) AS espera_promedio_min,
    AVG(DATEDIFF(MINUTE, t.fecha_llamado, t.fecha_fin)) AS atencion_promedio_min,
    AVG(DATEDIFF(MINUTE, t.fecha_generacion, t.fecha_fin)) AS total_promedio_min
FROM Ticket t
JOIN Servicio sv ON t.id_servicio = sv.id_servicio
WHERE t.fecha_fin IS NOT NULL AND t.fecha_llamado IS NOT NULL
GROUP BY sv.Nombre_Servicio
ORDER BY servicio;

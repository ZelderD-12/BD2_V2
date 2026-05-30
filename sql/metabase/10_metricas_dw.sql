-- ============================================================
-- METABASE — 10 Consultas para Dashboards
-- Base de datos: ClinicaF_DW (Data Warehouse)
-- ============================================================

-- ============================================================
-- 1. Espera promedio por sede y por hora
-- ============================================================
SELECT nombre_sede, hora, espera_prom_min, espera_max_min, total_tickets
FROM CubeEspera_Hora_Sede
ORDER BY nombre_sede, hora;

-- ============================================================
-- 2. SLA% por medico y especialidad
-- ============================================================
SELECT nombre_medico, nombre_especialidad,
       total_atenciones, atendidos_en_sla, sla_porcentaje
FROM CubeSLA_Medico_Servicio
ORDER BY nombre_especialidad, nombre_medico;

-- ============================================================
-- 3. No-show por dia/hora y por sede
-- ============================================================
SELECT nombre_sede, fecha, hora, total_tickets, total_no_show, pct_no_show
FROM CubeNoShow_Hora_Sede
ORDER BY nombre_sede, fecha, hora;

-- ============================================================
-- 4. Top diagnosticos por mes
-- ============================================================
SELECT anio, mes, diagnostico, total
FROM CubeDiagnosticos_Mes
ORDER BY anio DESC, mes DESC, total DESC;

-- ============================================================
-- 5. Top medicamentos por especialidad
-- ============================================================
SELECT dsv.nombre_especialidad AS especialidad,
       dm.nombre AS medicamento,
       COUNT(*) AS total_recetado
FROM FactRecetaDetalle frd
JOIN DimMedicamento dm ON frd.id_medicamento = dm.id_medicamento_dw
JOIN DimServicio dsv ON frd.id_servicio = dsv.id_servicio_dw
GROUP BY dsv.nombre_especialidad, dm.nombre
ORDER BY especialidad, total_recetado DESC;

-- ============================================================
-- 6. Demanda: citas solicitadas vs atendidas
-- ============================================================
SELECT f.anio, f.mes, f.dia,
       COUNT(*) AS solicitadas,
       SUM(CASE WHEN fc.es_atendida = 1 THEN 1 ELSE 0 END) AS atendidas
FROM FactCitas fc
JOIN DimFecha f ON fc.id_fecha = f.id_fecha
GROUP BY f.anio, f.mes, f.dia
ORDER BY f.anio, f.mes, f.dia;

-- ============================================================
-- 7. Productividad: pacientes/hora por medico
-- ============================================================
SELECT dm.nombre_completo AS medico,
       COUNT(*) AS total_atenciones,
       ROUND(COUNT(*) * 1.0 / NULLIF(COUNT(DISTINCT CAST(fa.id_fecha AS VARCHAR(8)) + '-' + CAST(f.hora AS VARCHAR(2))), 0), 1) AS pacientes_por_hora
FROM FactAtenciones fa
JOIN DimFecha f ON fa.id_fecha = f.id_fecha
JOIN DimMedico dm ON fa.id_medico = dm.id_medico_dw
WHERE fa.es_no_show = 0
GROUP BY dm.nombre_completo
ORDER BY pacientes_por_hora DESC;

-- ============================================================
-- 8. Distribucion de prioridades y fairness
-- ============================================================
SELECT nombre_sede, anio, semana, prioridad, total
FROM CubePrioridades_Semana_Sede
ORDER BY prioridad, nombre_sede, anio, semana;

-- ============================================================
-- 9. Backlog (tickets en cola) por servicio
-- ============================================================
SELECT nombre_servicio, nombre_especialidad,
       tickets_en_espera, espera_prom_min
FROM CubeBacklog_Servicio
ORDER BY tickets_en_espera DESC;

-- ============================================================
-- 10. Tiempos de atencion promedio por servicio
-- ============================================================
SELECT nombre_especialidad,
       AVG(espera_prom_min) AS espera_promedio_min,
       AVG(atencion_prom_min) AS atencion_promedio_min
FROM CubeAtenciones_Dia_Sede_Especialidad
GROUP BY nombre_especialidad
ORDER BY nombre_especialidad;

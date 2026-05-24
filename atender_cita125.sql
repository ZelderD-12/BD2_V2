UPDATE Cita SET id_estado_cita = 8 WHERE id_cita = 125;

IF NOT EXISTS (SELECT 1 FROM HistorialClinico WHERE id_cita = 125)
INSERT INTO HistorialClinico (id_cita, id_paciente, id_medico, diagnostico, sintomas, signos_vitales, notas_doctor, proxima_cita, estado, creado_por, fecha_creacion)
VALUES (125, 1, 2, 'Taquicardia sinusal leve', 'Palpitaciones, dolor toracico leve al hacer ejercicio, mareos', '{"peso":"72","talla":"170","presion_arterial":"130/85","temperatura":"36.5","frecuencia_cardiaca":"88","glucosa":"92"}', 'Paciente presenta taquicardia sinusal. Se recomienda ECG de control y evitar estimulantes. Se receta betabloqueante por 30 dias.', '2026-08-20', 'Atendida', 1, GETDATE());

IF NOT EXISTS (SELECT 1 FROM Receta WHERE id_cita = 125)
INSERT INTO Receta (Orden_Receta, id_cita, id_medico, id_paciente, observaciones, fecha_emision, estado, medicamentos_json)
VALUES ('RX-20260523-0125', 125, 2, 1, 'Tomar en ayunas. No suspender bruscamente.', GETDATE(), 'Activa',
'[{"nombre":"Propranolol","dosis":"40mg","cada":"12","duracion":"30"},{"nombre":"Magnesio","dosis":"400mg","cada":"24","duracion":"60"}]');

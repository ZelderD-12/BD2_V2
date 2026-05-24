import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const EMAIL = __ENV.EMAIL || 'tobiasgusito@gmail.com';
const PASSWORD = __ENV.PASSWORD || '123456789';

const ID_SEDE = parseInt(__ENV.ID_SEDE || '1');
const ID_SERVICIO = parseInt(__ENV.ID_SERVICIO || '3');
const ID_MEDICO = parseInt(__ENV.ID_MEDICO || '2');
const SLOT_FECHA = __ENV.SLOT_FECHA || '2026-06-06T14:00:00.000';

const VUS = parseInt(__ENV.VUS || '200');

export const options = {
    setupTimeout: '120s',
    scenarios: {
        g2_tickets: {
            executor: 'per-vu-iterations',
            vus: VUS,
            iterations: 1,
            maxDuration: '5m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<10000'],
        http_req_failed: ['rate<0.1'],
    },
};

export function setup() {
    const loginRes = http.post(`${BASE_URL}/Login`,
        JSON.stringify({ email: EMAIL, password: PASSWORD }),
        { headers: { 'Content-Type': 'application/json' } },
    );
    const token = loginRes.json('token');
    if (!token) throw new Error('Login failed: ' + loginRes.body);

    const runId = Date.now();

    const pacienteRes = http.post(`${BASE_URL}/Usuario/crear`,
        JSON.stringify({
            nombres: `G2Paciente_${runId}`,
            apellidos: 'Test',
            dpi: String(9000000000000 + (runId % 1000000)),
            telefono: String(80000000 + (runId % 10000000)),
            direccion: 'Test G2',
            rol: 2,
            sexo: 'M',
            fecha_nacimiento: '1990-01-01',
            email: `g2.${runId}@test.com`,
            password: '12345678',
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        },
    );
    const idPaciente = pacienteRes.json('data.id_usuario');
    if (!idPaciente) throw new Error('Failed to create patient: ' + pacienteRes.body);

    const citaRes = http.post(`${BASE_URL}/api/reservar/cita`,
        JSON.stringify({
            id_paciente: parseInt(idPaciente),
            id_medico: ID_MEDICO,
            id_servicio: ID_SERVICIO,
            id_sede: ID_SEDE,
            fecha_inicio: SLOT_FECHA,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        },
    );
    const idCita = citaRes.json('data') ? parseInt(citaRes.json('data').id_cita) : null;
    if (!idCita) throw new Error('Failed to create cita: ' + citaRes.body);

    const confirmRes = http.post(`${BASE_URL}/api/reservar/cita/${idCita}/confirmar`,
        JSON.stringify({ id_paciente: parseInt(idPaciente) }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        },
    );
    if (confirmRes.status !== 200) {
        throw new Error('Failed to confirm cita: ' + confirmRes.body);
    }

    console.log(`G2 setup: cita #${idCita} CONFIRMADA`);
    console.log(`500 VUs will try to generate a ticket for this cita. Only 1 should succeed.`);

    return { token, id_cita: idCita };
}

export default function (data) {
    const res = http.post(`${BASE_URL}/api/tickets/generar`,
        JSON.stringify({ id_cita: data.id_cita }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`,
            },
        },
    );

    check(res, {
        'status 201 (TICKET_CREADO) o 409 (TICKET_DUPLICADO)': (r) => r.status === 201 || r.status === 409,
        'sin error 500': (r) => r.status !== 500,
        'sin error 401': (r) => r.status !== 401,
        'sin error 422': (r) => r.status !== 422,
    });
}

export function handleSummary(data) {
    const reqs = data.metrics.http_reqs ? data.metrics.http_reqs.values : {};
    const dur = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};

    console.log('--- G2 SUMMARY ---');
    console.log(JSON.stringify({
        total_requests: reqs.count,
        duracion_p95_ms: dur.p95,
        duracion_avg_ms: dur.avg,
        success_rate: 1 - (data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : 0),
    }, null, 2));

    return {};
}

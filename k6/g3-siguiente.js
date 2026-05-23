import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const EMAIL = __ENV.EMAIL || 'tobiasgusito@gmail.com';
const PASSWORD = __ENV.PASSWORD || '123456789';

const ID_SEDE = parseInt(__ENV.ID_SEDE || '1');
const ID_SERVICIO = parseInt(__ENV.ID_SERVICIO || '1');
const TICKETS_QTY = 250;

export const options = {
    setupTimeout: '300s',
    scenarios: {
        g3_siguiente: {
            executor: 'per-vu-iterations',
            vus: 200,
            iterations: 1,
            maxDuration: '5m',
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<10000'],
        http_req_failed: ['rate<0.2'],
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
    const pacientes = [];
    const batchSize = 50;

    const totalBatchesPatients = Math.ceil(TICKETS_QTY / batchSize);
    for (let b = 0; b < totalBatchesPatients; b++) {
        const reqs = [];
        const start = b * batchSize + 1;
        const end = Math.min(start + batchSize - 1, TICKETS_QTY);
        for (let i = start; i <= end; i++) {
            reqs.push({
                method: 'POST',
                url: `${BASE_URL}/Usuario/crear`,
                body: JSON.stringify({
                    nombres: `G3Paciente_${runId}_${i}`,
                    apellidos: `Test_${runId}`,
                    dpi: String(8000000000000 + (i % 9999)),
                    telefono: '11223344',
                    direccion: 'Test G3',
                    rol: 2,
                    sexo: i % 2 === 0 ? 'M' : 'F',
                    fecha_nacimiento: '1995-05-15',
                    email: `g3.${runId}.${i}@test.com`,
                    password: '12345678',
                }),
                params: {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                },
            });
        }
        const responses = http.batch(reqs);
        for (const res of responses) {
            const data = res.json('data');
            const id = data ? parseInt(data.id_usuario) : null;
            if (id) {
                pacientes.push({ id, nombres: `G3Paciente_${runId}_${id}`, apellidos: `Test_${runId}` });
            }
        }
    }

    console.log(`G3 setup: ${pacientes.length} pacientes creados`);

    const tickets = [];
    const totalBatchesTickets = Math.ceil(pacientes.length / batchSize);
    for (let b = 0; b < totalBatchesTickets; b++) {
        const reqs = [];
        const start = b * batchSize;
        const end = Math.min(start + batchSize, pacientes.length);
        for (let j = start; j < end; j++) {
            const p = pacientes[j];
            reqs.push({
                method: 'POST',
                url: `${BASE_URL}/api/tickets/generar`,
                body: JSON.stringify({
                    nombres: p.nombres,
                    apellidos: p.apellidos,
                    id_sede: ID_SEDE,
                    prioridad: 'NORMAL',
                }),
                params: {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                },
            });
        }
        const responses = http.batch(reqs);
        for (const res of responses) {
            const ticketData = res.json('data');
            const id = ticketData ? parseInt(ticketData.id_ticket) : null;
            if (id) {
                tickets.push(id);
            }
        }
    }

    console.log(`G3 setup: ${tickets.length} tickets en cola (EN_ESPERA) para sede=${ID_SEDE}, servicio=${ID_SERVICIO}`);
    console.log(`200 VUs llamaran siguiente concurrentemente. Cada uno debe recibir un ticket unico.`);

    return { token, id_sede: ID_SEDE, id_servicio: ID_SERVICIO };
}

export default function (data) {
    const res = http.post(`${BASE_URL}/api/tickets/siguiente`,
        JSON.stringify({
            id_sede: data.id_sede,
            id_servicio: data.id_servicio,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`,
            },
            tags: { vu: `vu_${__VU}` },
        },
    );

    check(res, {
        'status 200 (ticket llamado)': (r) => r.status === 200,
        'o 404 (cola vacia) si se agotaron tickets': (r) => r.status === 200 || r.status === 404,
        'sin error 500': (r) => r.status !== 500,
        'sin error 409 (ticket ya tomado)': (r) => r.status !== 409,
    });
}

export function handleSummary(data) {
    const reqs = data.metrics.http_reqs ? data.metrics.http_reqs.values : {};
    const dur = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
    const failed = data.metrics.http_req_failed ? data.metrics.http_req_failed.values : {};

    console.log('--- G3 SUMMARY ---');
    console.log(JSON.stringify({
        total_requests: reqs.count,
        duracion_p95_ms: dur.p95,
        duracion_avg_ms: dur.avg,
        fail_rate: failed.rate,
    }, null, 2));

    return {};
}

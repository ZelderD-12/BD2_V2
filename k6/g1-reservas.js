import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const EMAIL = __ENV.EMAIL || 'tobiasgusito@gmail.com';
const PASSWORD = __ENV.PASSWORD || '123456789';

const ID_SEDE = parseInt(__ENV.ID_SEDE || '1');
const ID_SERVICIO = parseInt(__ENV.ID_SERVICIO || '3');
const ID_MEDICO = parseInt(__ENV.ID_MEDICO || '2');

const SLOT_FECHA = __ENV.SLOT_FECHA || '2026-06-06T10:00:00.000';

const VUS = parseInt(__ENV.VUS || '200');
const PACIENTES_QTY = VUS;

export const options = {
    setupTimeout: '300s',
    scenarios: {
        g1_reservas: {
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
    const id_usuario = loginRes.json('usuario.id');

    if (!token) {
        throw new Error('Login failed: ' + loginRes.body);
    }

    const sedesRes = http.get(`${BASE_URL}/api/sedes`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const sedes = sedesRes.json('data');
    const sede = sedes ? sedes.find(s => s.id_sede === ID_SEDE) : null;
    const capacidad = (sede && sede.capacidad_slots) || 5;

    const pacientesIds = [];
    const batchSize = 50;
    const totalBatches = Math.ceil(PACIENTES_QTY / batchSize);
    const runId = Date.now();

    for (let batch = 0; batch < totalBatches; batch++) {
        const requests = [];
        const start = batch * batchSize + 1;
        const end = Math.min(start + batchSize - 1, PACIENTES_QTY);

        for (let i = start; i <= end; i++) {
            requests.push({
                method: 'POST',
                url: `${BASE_URL}/Usuario/crear`,
                body: JSON.stringify({
                    nombres: `G1Paciente_${runId}_${i}`,
                    apellidos: `Test_${runId}`,
                    dpi: String(1000000000000 + i + (runId % 100000) * 1000),
                    telefono: String(10000000 + ((runId % 10000) * batchSize + i) % 89999999),
                    direccion: 'Test G1',
                    rol: 2,
                    sexo: i % 2 === 0 ? 'M' : 'F',
                    fecha_nacimiento: '1990-01-01',
                    email: `g1.${runId}.${i}@test.com`,
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

        const responses = http.batch(requests);
        for (const res of responses) {
            const data = res.json('data');
            const id = data ? parseInt(data.id_usuario) : null;
            if (id) {
                pacientesIds.push(id);
            }
        }
    }

    console.log(`G1 setup: ${pacientesIds.length} pacientes disponibles, capacidad_slots=${capacidad}`);
    console.log(`Target: slot=${SLOT_FECHA}, sede=${ID_SEDE}, servicio=${ID_SERVICIO}, medico=${ID_MEDICO}`);

    return {
        token,
        pacientes: pacientesIds,
        capacidad,
        id_usuario,
    };
}

export default function (data) {
    const idx = __VU - 1;
    const idPaciente = data.pacientes[idx];

    if (!idPaciente) {
        check(false, { 'no hay paciente disponible': () => false });
        return;
    }

    const res = http.post(`${BASE_URL}/api/reservar/cita`,
        JSON.stringify({
            id_paciente: idPaciente,
            id_medico: ID_MEDICO,
            id_servicio: ID_SERVICIO,
            id_sede: ID_SEDE,
            fecha_inicio: SLOT_FECHA,
        }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${data.token}`,
            },
        },
    );

    check(res, {
        'status 201 (CITA_CREADA) o 409 (SIN_CUPO)': (r) => r.status === 201 || r.status === 409,
        'sin error 500': (r) => r.status !== 500,
    });
}

export function handleSummary(data) {
    const reservas = data.metrics.http_req_duration ? data.metrics.http_req_duration.values : {};
    const esperados = { success: 201, conflict: 409 };

    console.log('--- G1 SUMMARY ---');
    console.log(JSON.stringify({
        total_requests: data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 0,
        duracion_p95_ms: reservas.p95,
        duracion_avg_ms: reservas.avg,
    }, null, 2));

    return {};
}

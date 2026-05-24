import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const SLOT_FECHA = __ENV.SLOT_FECHA || '2026-07-15T10:00:00.000';
const ID_SEDE = parseInt(__ENV.ID_SEDE || '1');
const ID_SERVICIO = parseInt(__ENV.ID_SERVICIO || '3');
const ID_MEDICO = parseInt(__ENV.ID_MEDICO || '2');
const INTENTOS = parseInt(__ENV.INTENTOS || '5');
const DELAY_S = parseFloat(__ENV.DELAY_S || '1');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'tobiasgusito@gmail.com';
const ADMIN_PASS = __ENV.ADMIN_PASS || '123456789';

export const options = {
    setupTimeout: '60s',
    vus: 1,
    iterations: 1,
};

export function setup() {
    const loginRes = http.post(`${BASE_URL}/Login`,
        JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
        { headers: { 'Content-Type': 'application/json' } },
    );
    const token = loginRes.json('token');
    if (!token) throw new Error('Login failed');

    const runId = Date.now();
    const pacientes = [];

    for (let i = 1; i <= INTENTOS; i++) {
        const crearRes = http.post(`${BASE_URL}/Usuario/crear`,
            JSON.stringify({
                nombres: `Paciente_${i}`,
                apellidos: `DemoG1_${runId}`,
                dpi: String(1000000000000 + runId + i),
                telefono: String(40000000 + (runId % 10000000) + i),
                direccion: 'Ciudad de Guatemala',
                rol: 2,
                sexo: i % 2 === 0 ? 'M' : 'F',
                fecha_nacimiento: '1990-01-01',
                email: `demo.g1.${runId}.${i}@test.com`,
                password: '12345678',
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            },
        );

        const data = crearRes.json('data');
        const idPaciente = data ? parseInt(data.id_usuario) : null;
        if (idPaciente) {
            pacientes.push(idPaciente);
        }
    }

    console.log(`Pacientes creados: ${pacientes.length} (ID: ${pacientes.join(', ')})`);

    const sedesRes = http.get(`${BASE_URL}/api/sedes`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    const sedeArr = sedesRes.json('data');
    const capacidad = (sedeArr && sedeArr[0] && sedeArr[0].capacidad_slots) || 5;

    return { token, pacientes, capacidad };
}

export default function (data) {
    console.log('═══════════════════════════════════════════════════');
    console.log(`INICIO DEMOSTRACIÓN G1 — Slot: ${SLOT_FECHA}`);
    console.log(`Sede #${ID_SEDE} | Servicio #${ID_SERVICIO} | Médico #${ID_MEDICO}`);
    console.log(`Capacidad del slot: ${data.capacidad}`);
    console.log('═══════════════════════════════════════════════════\n');

    let exitosos = 0;
    let rechazados = 0;
    let resultadoFinal = null;

    for (let i = 0; i < data.pacientes.length; i++) {
        const res = http.post(`${BASE_URL}/api/reservar/cita`,
            JSON.stringify({
                id_paciente: data.pacientes[i],
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

        resultadoFinal = res;

        if (res.status === 201) {
            exitosos++;
            console.log(`  ✅ Paciente #${i + 1} (id=${data.pacientes[i]}) → 201 CITA CREADA`);
        } else if (res.status === 409) {
            rechazados++;
            console.log(`  ❌ Paciente #${i + 1} (id=${data.pacientes[i]}) → 409 SIN CUPO`);
        } else {
            console.log(`  ⚠️  Paciente #${i + 1} (id=${data.pacientes[i]}) → ${res.status}: ${res.body}`);
        }

        if (i < data.pacientes.length - 1) {
            console.log(`  ⏳ Esperando ${DELAY_S}s...\n`);
            sleep(DELAY_S);
        }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`RESULTADO: ${exitosos} aceptada(s), ${rechazados} rechazada(s)`);
    console.log(`➡️  Gate 1: el slot solo acepta ${data.capacidad} cita(s)`);
    console.log('═══════════════════════════════════════════════════');

    check(resultadoFinal, {
        'hubo al menos 1 cita creada (201)': () => exitosos >= 1,
        'hubo al menos 1 rechazo por cupo (409)': () => rechazados >= 1,
    });
}

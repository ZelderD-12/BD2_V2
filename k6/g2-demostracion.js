import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const ID_SEDE = parseInt(__ENV.ID_SEDE || '1');
const ID_SERVICIO = parseInt(__ENV.ID_SERVICIO || '3');
const ID_MEDICO = parseInt(__ENV.ID_MEDICO || '2');
const SLOT_FECHA = __ENV.SLOT_FECHA || '2026-07-20T10:00:00.000';
const INTENTOS = parseInt(__ENV.INTENTOS || '5');
const DELAY_S = parseFloat(__ENV.DELAY_S || '1');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'tobiasgusito@gmail.com';
const ADMIN_PASS = __ENV.ADMIN_PASS || '123456789';

export const options = {
    setupTimeout: '30s',
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

    const crearRes = http.post(`${BASE_URL}/Usuario/crear`,
        JSON.stringify({
            nombres: 'Maria',
            apellidos: 'Gonzalez',
            dpi: String(2000000000000 + runId),
            telefono: String(50000000 + (runId % 10000000)),
            direccion: 'Antigua Guatemala, Sacatepequez',
            rol: 2,
            sexo: 'F',
            fecha_nacimiento: '1992-07-22',
            email: `maria.gonzalez.${runId}@email.com`,
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
    if (!idPaciente) throw new Error('Falló crear paciente: ' + crearRes.body);

    console.log(`Paciente creado: id=${idPaciente}, nombre=Maria Gonzalez`);

    const citaRes = http.post(`${BASE_URL}/api/reservar/cita`,
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
                'Authorization': `Bearer ${token}`,
            },
        },
    );

    const body = citaRes.json();
    const idCita = body.data ? parseInt(body.data.id_cita) : null;
    if (!idCita) throw new Error('Falló crear cita: ' + citaRes.body);

    console.log(`Cita creada: id=${idCita}`);

    const confirmRes = http.post(`${BASE_URL}/api/reservar/cita/${idCita}/confirmar`,
        JSON.stringify({ id_paciente: idPaciente }),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        },
    );

    if (confirmRes.status !== 200) {
        throw new Error('Falló confirmar cita: ' + confirmRes.body);
    }

    console.log(`Cita confirmada: id=${idCita}\n`);

    return { token, id_cita: idCita, id_paciente: idPaciente };
}

export default function (data) {
    console.log('═══════════════════════════════════════════════════');
    console.log(`INICIO DEMOSTRACIÓN G2 — Cita #${data.id_cita} confirmada`);
    console.log('═══════════════════════════════════════════════════\n');

    let exitosos = 0;
    let rechazados = 0;

    for (let i = 1; i <= INTENTOS; i++) {
        const res = http.post(`${BASE_URL}/api/tickets/generar`,
            JSON.stringify({ id_cita: data.id_cita }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.token}`,
                },
            },
        );

        const body = res.json();

        if (res.status === 201) {
            exitosos++;
            console.log(`  ✅ Intento #${i} → 201 TICKET CREADO   (ticket #${body.data?.id_ticket})`);
        } else if (res.status === 409) {
            rechazados++;
            console.log(`  ❌ Intento #${i} → 409 TICKET DUPLICADO (${body.error || body.mensaje || 'ya existe ticket'})`);
        } else {
            console.log(`  ⚠️  Intento #${i} → ${res.status}: ${res.body}`);
        }

        if (i < INTENTOS) {
            console.log(`  ⏳ Esperando ${DELAY_S}s...\n`);
            sleep(DELAY_S);
        }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`RESULTADO: ${exitosos} ticket(es) creado(s), ${rechazados} rechazo(s)`);
    console.log('➡️  Gate 2: solo se genera 1 ticket por cita');
    console.log('═══════════════════════════════════════════════════');

    check(res, {
        'primer ticket se creó (201)': () => exitosos >= 1,
        'los demás fueron rechazados (409)': () => rechazados >= 1,
    });
}

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const ID_SEDE = parseInt(__ENV.ID_SEDE || '1');
const CANTIDAD = parseInt(__ENV.CANTIDAD || '5');
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

    for (let i = 1; i <= CANTIDAD; i++) {
        const crearRes = http.post(`${BASE_URL}/Usuario/crear`,
            JSON.stringify({
                nombres: `Paciente_${i}`,
                apellidos: `DemoG3_${runId}`,
                dpi: String(3000000000000 + runId + i),
                telefono: String(60000000 + (runId % 10000000) + i),
                direccion: 'Quetzaltenango',
                rol: 2,
                sexo: i % 2 === 0 ? 'M' : 'F',
                fecha_nacimiento: '1995-05-15',
                email: `demo.g3.${runId}.${i}@test.com`,
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
            pacientes.push({ id: idPaciente, nombres: `Paciente_${i}`, apellidos: `DemoG3_${runId}` });
        }
    }

    console.log(`Pacientes creados: ${pacientes.length}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('CREANDO TICKETS EN COLA...');
    console.log('═══════════════════════════════════════════════════');

    const tickets = [];

    for (let i = 0; i < pacientes.length; i++) {
        const p = pacientes[i];

        const res = http.post(`${BASE_URL}/api/tickets/generar`,
            JSON.stringify({
                nombres: p.nombres,
                apellidos: p.apellidos,
                id_sede: ID_SEDE,
                prioridad: 'NORMAL',
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            },
        );

        const body = res.json();
        const ticketData = body.data;
        const idTicket = ticketData ? parseInt(ticketData.id_ticket) : null;

        if (idTicket) {
            tickets.push(idTicket);
            console.log(`  🎫 Ticket #${idTicket} — ${p.nombres} ${p.apellidos}`);
        } else {
            console.log(`  ⚠️  Falló ticket para ${p.nombres}: ${res.body}`);
        }

        if (i < pacientes.length - 1) {
            console.log(`  ⏳ Esperando ${DELAY_S}s...\n`);
            sleep(DELAY_S);
        }
    }

    console.log(`\nTotal tickets en cola: ${tickets.length} (EN_ESPERA)\n`);

    return { token, id_sede: ID_SEDE, total_tickets: tickets.length };
}

export default function (data) {
    console.log('═══════════════════════════════════════════════════');
    console.log(`INICIO DEMOSTRACIÓN G3 — ${data.total_tickets} tickets en cola`);
    console.log('═══════════════════════════════════════════════════\n');

    let atendidos = 0;
    let vacio = 0;

    for (let i = 1; i <= data.total_tickets + 1; i++) {
        const res = http.post(`${BASE_URL}/api/tickets/siguiente`,
            JSON.stringify({
                id_sede: data.id_sede,
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.token}`,
                },
            },
        );

        const body = res.json();

        if (res.status === 200) {
            atendidos++;
            const t = body.data;
            console.log(`  ✅ Llamado #${i} → Ticket #${t?.id_ticket || '?'} (${t?.nombres || ''} ${t?.apellidos || ''})`);
        } else if (res.status === 404) {
            vacio++;
            console.log(`  📭 Llamado #${i} → 404 COLA VACÍA   (${body.error || body.mensaje || 'sin tickets'})`);
        } else {
            console.log(`  ⚠️  Llamado #${i} → ${res.status}: ${res.body}`);
        }

        if (i < data.total_tickets + 1) {
            console.log(`  ⏳ Esperando ${DELAY_S}s...\n`);
            sleep(DELAY_S);
        }
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`RESULTADO: ${atendidos} ticket(s) atendido(s), ${vacio} vez/veces cola vacía`);
    console.log('➡️  Gate 3: cada llamada a siguiente obtiene un ticket único hasta vaciar la cola');
    console.log('═══════════════════════════════════════════════════');

    check(res, {
        'se atendieron tickets (200)': () => atendidos >= 1,
        'la cola quedó vacía (404)': () => vacio >= 1,
    });
}

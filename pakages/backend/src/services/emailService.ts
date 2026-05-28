import nodemailer from 'nodemailer';

const emailUser = (process.env.EMAIL_USER || '').replace(/^"(.*)"$/, '$1');
const emailPass = (process.env.EMAIL_PASS || '').replace(/^"(.*)"$/, '$1');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: emailUser, pass: emailPass },
});

function logError(context: string, err: unknown) {
    console.error(`[Email][${context}]`, err instanceof Error ? err.message : err);
}

if (emailUser) console.log(`[Email] Servicio configurado para ${emailUser}`);

export function sendLlamadoEmail(
    pacienteEmail: string,
    pacienteNombre: string,
    codigoTicket: string,
    nombreSede: string
) {
    setTimeout(async () => {
        try {
            await transporter.sendMail({
                from: `"Clinica" <${emailUser}>`,
                to: pacienteEmail,
                subject: `${codigoTicket} - Usted ha sido llamado en ${nombreSede}`,
                html: `
                    <h2>Hola ${pacienteNombre},</h2>
                    <p>Su <strong>Ticket ${codigoTicket}</strong> ha sido <strong>llamado</strong> en <strong>${nombreSede}</strong>.</p>
                    <p>Por favor diríjase a recepción.</p>
                    <br>
                    <p>Gracias por su paciencia.</p>
                `,
            });
        } catch (err) {
            logError('Llamado', err);
        }
    }, 0);
}

export function sendNoShowEmail(
    pacienteEmail: string,
    pacienteNombre: string,
    codigoTicket: string,
    nombreSede: string
) {
    setTimeout(async () => {
        try {
            await transporter.sendMail({
                from: `"Clinica" <${emailUser}>`,
                to: pacienteEmail,
                subject: `${codigoTicket} - Tiempo límite vencido en ${nombreSede}`,
                html: `
                    <h2>Hola ${pacienteNombre},</h2>
                    <p>Su <strong>Ticket ${codigoTicket}</strong> en <strong>${nombreSede}</strong> ha superado el tiempo límite de atención.</p>
                    <p>Su turno ha sido marcado como <strong>No Show</strong>.</p>
                    <p>Por favor acérquese a recepción para reasignar su turno.</p>
                    <br>
                    <p>Disculpe las molestias.</p>
                `,
            });
        } catch (err) {
            logError('NoShow', err);
        }
    }, 0);
}

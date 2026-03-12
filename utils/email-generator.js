import nodemailer from 'nodemailer';

export const sendEmailWithAttachment = async (to, subject, text, attachmentBuffer, filename) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: false,
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD,
            },
            logger: true,
            debug: true
        });

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
            to,
            subject,
            text,
            attachments: [
                {
                    filename,
                    content: attachmentBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error("Error enviando email:", error);
        throw new Error("No se pudo enviar el correo electrónico.");
    }
};

export const generateUniformEmail = (nombre, nivel, grado, reason) => {
    const baseStyles = 'font-family: Arial, sans-serif; padding: 20px; border-radius: 10px;';
    
    const mensajeMotivo = reason === 'ACCESORIO_NO_PERMITIDO' 
        ? 'el uso de accesorios no son permitidos ' 
        : 'que no portas el uniforme completo';

    const subjectMotivo = reason === 'ACCESORIO_NO_PERMITIDO' ? 'Accesorio No Permitido' : 'Uniforme Incompleto';

    if (nivel === 1) {
        return {
            subject: `Primera Advertencia: ${subjectMotivo}`,
            html: `<div style="${baseStyles} border: 2px solid #ffcc00; background-color: #fff9db;">
                    <h2 style="color: #856404;">Notificación de Normativa</h2>
                    <p>Estimado/a <b>${nombre}</b> de <b>${grado}</b>,</p>
                    <p>El sistema ha detectado <b>${mensajeMotivo}</b>. Esta es una <b>primera advertencia</b>.</p>
                    <p>Por favor, cumple con el reglamento de Kinal para evitar reportes.</p>
                   </div>`
        };
    }
    if (nivel === 2) {
        return {
            subject: `SEGUNDA ADVERTENCIA: Revisión de ${subjectMotivo}`,
            html: `<div style="${baseStyles} border: 2px solid #e67e22; background-color: #fef5e7;">
                    <h2 style="color: #a04000;">Segunda Advertencia</h2>
                    <p>Estimado/a <b>${nombre}</b>,</p>
                    <p>Se te ha detectado nuevamente con <b>${mensajeMotivo}</b>. Esta es tu <b>segunda advertencia</b>.</p>
                    <p>A la tercera detección, se notificará automáticamente a Coordinación.</p>
                   </div>`
        };
    }

    return {
        subject: `REPORTE DISCIPLINARIO: ${nombre} - ${grado}`,
        html: `<div style="${baseStyles} border: 2px solid #c0392b; background-color: #f9ebeb;">
                <h2 style="color: #7b241c;">Reporte a Coordinación</h2>
                <p><b>Atención Coordinador:</b></p>
                <p>El estudiante <b>${nombre}</b> de <b>${grado}</b> ha infringido las normas por 3ra vez.</p>
                <p><b>Motivo detectado:</b> ${mensajeMotivo.charAt(0).toUpperCase() + mensajeMotivo.slice(1)}.</p>
                <p>Se requiere seguimiento disciplinario inmediato.</p>
               </div>`
    };
};

export const sendSmartEmail = async (to, subject, html, image) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: false,
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD,
            }
        });

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
            to,
            subject,
            html,
            attachments: image ? [
                {
                    filename: 'evidencia_uniforme.jpg',
                    content: image,
                    encoding: 'base64'
                }
            ] : []
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error enviando email simple:", error);
        throw new Error("No se pudo enviar la alerta de correo.");
    }
};
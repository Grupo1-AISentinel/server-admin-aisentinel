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

export const generateUniformEmail = (nombre, nivel, grado, reason, timestamp) => {
    const baseStyles = 'font-family: Arial, sans-serif; padding: 20px; border-radius: 10px;';
    const dateFormatted = timestamp ? new Date(timestamp).toLocaleString('es-GT', { 
        timeZone: 'America/Guatemala',
        dateStyle: 'long', 
        timeStyle: 'short' 
    }) : 'Fecha no especificada';
    
    const mensajeMotivo = reason === 'ACCESORIO_NO_PERMITIDO' 
        ? 'el uso de accesorios no son permitidos ' 
        : 'que no portas el uniforme completo';

    const subjectMotivo = reason === 'ACCESORIO_NO_PERMITIDO' ? 'Accesorio No Permitido' : 'Uniforme Incompleto';

    const cycleCount = (nivel - 1) % 3 + 1; // 1, 2, o 3

    if (cycleCount === 1) {
        return {
            subject: `ADVERTENCIA 1/3: Notificación de Normativa - ${subjectMotivo}`,
            html: `<div style="${baseStyles} border: 2px solid #ffcc00; background-color: #fff9db;">
                    <h2 style="color: #856404;">Aviso de Normativa (1ra Advertencia)</h2>
                    <p>Estimado/a <b>${nombre}</b> de <b>${grado}</b>,</p>
                    <p>El sistema ha detectado <b>${mensajeMotivo}</b> el <b>${dateFormatted}</b>.</p>
                    <p>Esta es tu <b>primera advertencia</b> en el ciclo actual. Te faltan <b>2 advertencias</b> más para que se envíe un reporte automático a tu Coordinador de Grado.</p>
                    <p>Por favor, cumple con el reglamento de Kinal.</p>
                   </div>`
        };
    }
    if (cycleCount === 2) {
        return {
            subject: `ADVERTENCIA 2/3: Revisión de ${subjectMotivo}`,
            html: `<div style="${baseStyles} border: 2px solid #e67e22; background-color: #fef5e7;">
                    <h2 style="color: #a04000;">Aviso Importante (2da Advertencia)</h2>
                    <p>Estimado/a <b>${nombre}</b>,</p>
                    <p>Se te ha detectado nuevamente con <b>${mensajeMotivo}</b> el <b>${dateFormatted}</b>.</p>
                    <p>Esta es tu <b>segunda advertencia</b>. Si se detecta una infracción más, se enviará un reporte detallado con las 3 fotos de evidencia a tu Coordinador de Grado.</p>
                   </div>`
        };
    }

    return {
        subject: `REPORTE DE INFRACCIONES ACUMULADAS (3/3): ${nombre} - ${grado}`,
        html: `<div style="${baseStyles} border: 2px solid #c0392b; background-color: #f9ebeb;">
                <h2 style="color: #7b241c;">Reporte de Infracciones - Coordinación</h2>
                <p><b>Atención Coordinador:</b></p>
                <p>El estudiante <b>${nombre}</b> de <b>${grado}</b> ha acumulado un ciclo de <b>3 infracciones</b> normativas.</p>
                <p>Última detección procesada: <b>${dateFormatted}</b>.</p>
                <p>Se adjuntan las 3 imágenes de evidencia capturadas por el sistema AI Sentinel correspondientes a este ciclo para su revisión y seguimiento disciplinario.</p>
               </div>`
    };
};

export const sendSmartEmail = async (to, subject, html, images = []) => {
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

        // Asegurar que images sea un array si se pasa un solo string
        const imageList = Array.isArray(images) ? images : [images];

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
            to,
            subject,
            html,
            attachments: imageList.map((img, index) => ({
                filename: `evidencia_${index + 1}.jpg`,
                content: img,
                encoding: 'base64'
            }))
        };

        return await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error("Error enviando email smart:", error);
        throw new Error("No se pudo enviar la alerta de correo.");
    }
};
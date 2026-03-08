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
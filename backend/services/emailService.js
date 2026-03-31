import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    return transporter;
}

export const sendEmail = async ({ email, subject, message, html }) => {
    // If SMTP credentials are not provided, log the email and return success
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('--- MOCK EMAIL START ---');
        console.log(`To: ${email}`);
        console.log(`Subject: ${subject}`);
        console.log(`Message: ${message}`);
        console.log('--- MOCK EMAIL END ---');
        return true;
    }

    const mailOptions = {
        from: `SmartExpense <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        text: message,
        html,
    };

    try {
        const info = await getTransporter().sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${email} (messageId: ${info.messageId})`);
    } catch (err) {
        console.error(`❌ Failed to send email to ${email}:`, err.message);
        throw err;
    }
};

export const sendOtpEmail = async (email, otp) => {
    const subject = 'Your SmartExpense Verification Code';
    const message = `Your verification code is: ${otp}. It will expire in 10 minutes.`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #6366f1;">SmartExpense Verification</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4338ca; padding: 10px 0;">
                ${otp}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
        </div>
    `;

    await sendEmail({ email, subject, message, html });
};

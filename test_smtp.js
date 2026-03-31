import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const testSmtp = async () => {
    console.log('Testing SMTP with:');
    console.log(`Host: ${process.env.SMTP_HOST}`);
    console.log(`Port: ${process.env.SMTP_PORT}`);
    console.log(`User: ${process.env.SMTP_USER}`);
    
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('Error: SMTP credentials missing in .env');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        await transporter.verify();
        console.log('SMTP connection successful!');
    } catch (error) {
        console.error('SMTP connection failed:', error.message);
    }
};

testSmtp();

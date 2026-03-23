import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,   // ✅ SSL
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: `"Online Exam" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    };

    await transporter.sendMail(mailOptions);
};

export default sendEmail;
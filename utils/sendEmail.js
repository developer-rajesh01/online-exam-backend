import axios from "axios";

const sendEmail = async (to, subject, html) => {
    try {
        const response = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: {
                    name: "Online Exam",
                    email: process.env.EMAIL_FROM, // same as before
                },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html,
            },
            {
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("✅ Email sent:", response.data);
    } catch (error) {
        console.error(
            "❌ Email error:",
            error.response?.data || error.message
        );
    }
};

export default sendEmail;
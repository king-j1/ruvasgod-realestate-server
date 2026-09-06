const nodemailer = require("nodemailer");

const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_PORT) === "465",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

const sendPasswordResetEmail = async ({ email, resetUrl }) => {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  if (!transporter || !from) {
    return false;
  }

  await transporter.sendMail({
    from,
    to: email,
    subject: "Reset your Ruvasgod Auto password",
    text: `Use this link to reset your password. It expires in one hour:\n\n${resetUrl}`,
  });

  return true;
};

module.exports = {
  sendPasswordResetEmail,
};

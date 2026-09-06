const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

const normalizeEmail = (email) => {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

const isValidEmail = (email) => EMAIL_PATTERN.test(email);

const isStrongPassword = (password) => {
  return (
    typeof password === "string" &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= 200
  );
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  isValidEmail,
  isStrongPassword,
};

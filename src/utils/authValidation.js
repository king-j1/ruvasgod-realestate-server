const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 12;

const normalizeEmail = (email) => {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
};

const isValidEmail = (email) => EMAIL_PATTERN.test(email);

const normalizeUsername = (username) => {
  return typeof username === "string" ? username.trim().toLowerCase() : "";
};

const isValidUsername = (username) => {
  return USERNAME_PATTERN.test(username) && !username.includes("@");
};

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
  normalizeUsername,
  isValidEmail,
  isValidUsername,
  isStrongPassword,
};

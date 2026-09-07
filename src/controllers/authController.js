const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  normalizeUsername,
  isValidEmail,
  isStrongPassword,
  isValidUsername,
} = require("../utils/authValidation");
const { sendPasswordResetEmail } = require("../services/emailService");

const googleClient = new OAuth2Client();

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
});

const issueToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const createGoogleUsername = async (email) => {
  const emailName = normalizeUsername(email.split("@")[0]).replace(
    /[^a-z0-9_]/g,
    ""
  );
  const base = (emailName || "user").slice(0, 20);

  for (let suffix = 0; suffix <= 999; suffix += 1) {
    const suffixText = suffix === 0 ? "" : String(suffix);
    const candidate = `${base.slice(0, 20 - suffixText.length)}${suffixText}`;

    if (!isValidUsername(candidate)) {
      continue;
    }

    const existingUser = await User.exists({ username: candidate });

    if (!existingUser) {
      return candidate;
    }
  }

  throw new Error("Unable to create a unique Google username");
};

// Register
const register = async (req, res) => {
  try {
    const { username, name, email, phone, password } = req.body || {};
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);

    if (!username || !name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, name, email, phone and password are required",
      });
    }

    if (!isValidUsername(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        message:
          "Username must be 3 to 20 characters and use only letters, numbers, and underscores",
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const existingUsername = await User.exists({
      username: normalizedUsername,
    });

    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: "An account with this username already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      phone: phone.trim(),
      password: hashedPassword,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.username) {
        return res.status(409).json({
          success: false,
          message: "An account with this username already exists",
        });
      }

      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error("Registration error:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};


// Login
const login = async (req, res) => {
  try {
    const { identifier, email, password } = req.body || {};
    const loginIdentifier = identifier || email;
    const normalizedEmail = normalizeEmail(loginIdentifier);
    const normalizedUsername = normalizeUsername(loginIdentifier);

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Username or email and password are required",
      });
    }

    const identifierQuery = isValidEmail(normalizedEmail)
      ? { email: normalizedEmail }
      : isValidUsername(normalizedUsername)
        ? { username: normalizedUsername }
        : null;

    if (!identifierQuery) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Explicitly include password because User model uses select: false
    const user = await User.findOne(identifierQuery).select(
      "+password +tokenVersion"
    );

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Reject deactivated staff/admin accounts at login
    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated. Please contact an administrator.",
      });
    }

    const token = issueToken(user);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

const forgotPassword = async (req, res) => {
  const genericResponse = {
    success: true,
    message: "If an account exists for that email, reset instructions will be sent.",
  };

  try {
    const normalizedEmail = normalizeEmail(req.body?.email);

    if (!isValidEmail(normalizedEmail)) {
      return res.json(genericResponse);
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);
    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      return res.json(genericResponse);
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: resetTokenHash,
          passwordResetExpiresAt: resetExpires,
        },
      }
    );

    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(
      resetToken
    )}`;
    let sent = false;

    try {
      sent = await sendPasswordResetEmail({
        email: normalizedEmail,
        resetUrl,
      });
    } catch (error) {
      console.error("Password reset email error:", error.message);
    }

    if (!sent) {
      await User.updateOne(
        { _id: user._id },
        {
          $unset: {
            passwordResetTokenHash: 1,
            passwordResetExpiresAt: 1,
          },
        }
      );
    }

    return res.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.json(genericResponse);
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || !isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.findOneAndUpdate(
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
        },
        $unset: {
          passwordResetTokenHash: 1,
          passwordResetExpiresAt: 1,
        },
        $inc: {
          tokenVersion: 1,
        },
      },
      { new: true }
    ).select("+tokenVersion");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This password reset link is invalid or expired",
      });
    }

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Password reset failed",
    });
  }
};

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body || {};

    if (!credential || !process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({
        success: false,
        message: "Google sign-in is not configured",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true ||
      !["accounts.google.com", "https://accounts.google.com"].includes(
        payload.iss
      )
    ) {
      return res.status(401).json({
        success: false,
        message: "Google sign-in could not be verified",
      });
    }

    const email = normalizeEmail(payload.email);
    let user = await User.findOne({ email }).select("+googleId +tokenVersion");

    if (user) {
      if (user.isActive === false) {
        return res.status(403).json({
          success: false,
          message: "This account has been deactivated. Please contact an administrator.",
        });
      }

      if (user.googleId && user.googleId !== payload.sub) {
        return res.status(409).json({
          success: false,
          message: "This email is already linked to another Google account",
        });
      }

      if (!user.googleId) {
        user.googleId = payload.sub;
        await user.save();
      }
    } else {
      user = await User.create({
        name: (payload.name || email.split("@")[0]).trim(),
        email,
        phone: "",
        username: await createGoogleUsername(email),
        googleId: payload.sub,
        role: "customer",
      });
    }

    return res.json({
      success: true,
      message: "Login successful",
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Google sign-in error:", error);
    return res.status(401).json({
      success: false,
      message: "Google sign-in could not be verified",
    });
  }
};


module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleLogin,
};
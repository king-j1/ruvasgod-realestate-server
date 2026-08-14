const axios = require("axios");

const initializePayment = async ({
  email,
  amount,
  reference,
  metadata,
}) => {
  try {
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount,
        currency: "GHS",
        reference,
        metadata,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "Paystack initialization error:",
      error.response?.data || error.message
    );

    throw new Error("Unable to initialize payment");
  }
};

module.exports = {
  initializePayment,
};
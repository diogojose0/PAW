const https = require("https");

const STRIPE_API_HOST = "api.stripe.com";

function getStripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || "").trim();
}

function getStripeCurrency() {
  return String(process.env.STRIPE_CURRENCY || "eur")
    .trim()
    .toLowerCase();
}

function getFrontendUrl() {
  return String(process.env.FRONTEND_URL || "http://localhost:4200").replace(
    /\/$/,
    "",
  );
}

function toStripeAmount(value) {
  return Math.round(Number(value || 0) * 100);
}

function buildFormBody(params) {
  const body = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      body.append(key, String(value));
    }
  });

  return body.toString();
}

function stripeRequest({ method, path, body }) {
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    return Promise.reject(
      new Error("Stripe is not configured. Missing STRIPE_SECRET_KEY."),
    );
  }

  const encodedBody = body ? buildFormBody(body) : null;

  const options = {
    hostname: STRIPE_API_HOST,
    path,
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  };

  if (encodedBody) {
    options.headers["Content-Type"] = "application/x-www-form-urlencoded";
    options.headers["Content-Length"] = Buffer.byteLength(encodedBody);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        let parsedBody = null;

        try {
          parsedBody = responseBody ? JSON.parse(responseBody) : {};
        } catch (error) {
          return reject(new Error("Invalid response from Stripe."));
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(parsedBody?.error?.message || "Stripe request failed."),
          );
        }

        return resolve(parsedBody);
      });
    });

    req.on("error", reject);

    if (encodedBody) {
      req.write(encodedBody);
    }

    req.end();
  });
}

async function createCheckoutSessionForOrder(order, clientUser) {
  const amountInCents = toStripeAmount(order.finalTotal);

  if (amountInCents <= 0) {
    throw new Error("This order has no amount to pay with Stripe.");
  }

  const frontendUrl = getFrontendUrl();
  const orderId = String(order._id);
  const shortOrderId = orderId.slice(-6).toUpperCase();

  const session = await stripeRequest({
    method: "POST",
    path: "/v1/checkout/sessions",
    body: {
      mode: "payment",
      client_reference_id: orderId,
      customer_email: clientUser.email,
      success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/orders/${orderId}`,

      "payment_method_types[0]": "card",

      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": getStripeCurrency(),
      "line_items[0][price_data][unit_amount]": amountInCents,
      "line_items[0][price_data][product_data][name]": `Marketplace order #${shortOrderId}`,
      "line_items[0][price_data][product_data][description]": `${order.items.length} product(s), delivery included`,

      "metadata[orderId]": orderId,
      "metadata[clientUserId]": String(order.clientUserId),
    },
  });

  return session;
}

async function retrieveCheckoutSession(sessionId) {
  const safeSessionId = encodeURIComponent(String(sessionId || "").trim());

  if (!safeSessionId) {
    throw new Error("Stripe session ID is required.");
  }

  return stripeRequest({
    method: "GET",
    path: `/v1/checkout/sessions/${safeSessionId}`,
  });
}

module.exports = {
  createCheckoutSessionForOrder,
  retrieveCheckoutSession,
};

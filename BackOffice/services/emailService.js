const nodemailer = require("nodemailer");
const Order = require("../models/Order");

let cachedTransporter = null;

function isSimulationEnabled() {
  return String(process.env.EMAIL_SIMULATION || "").toLowerCase() === "true";
}

function isEmailEnabled() {
  const raw = String(process.env.EMAIL_NOTIFICATIONS_ENABLED || "true").toLowerCase();
  return raw !== "false";
}

function buildTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (isSimulationEnabled()) {
    cachedTransporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port) {
    return null;
  }

  const transporterConfig = {
    host,
    port,
    secure:
      String(process.env.SMTP_SECURE || "").toLowerCase() === "true" ||
      port === 465,
  };

  if (user && pass) {
    transporterConfig.auth = {
      user,
      pass,
    };
  }

  cachedTransporter = nodemailer.createTransport(transporterConfig);
  return cachedTransporter;
}

function getStatusLabel(status) {
  const labels = {
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    delivering: "Delivering",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  return labels[status] || status;
}

function buildSubject(order) {
  return `Order #${order._id} updated to ${getStatusLabel(order.status)}`;
}

function buildText(order) {
  const clientName = order.clientUserId?.name || "Customer";
  const supermarketName = order.supermarketId?.name || "the supermarket";

  return [
    `Hello ${clientName},`,
    "",
    `Your order #${order._id} from ${supermarketName} has changed status.`,
    `New status: ${getStatusLabel(order.status)}`,
    `Delivery method: ${order.deliveryMethod}`,
    `Order total: €${Number(order.finalTotal || 0).toFixed(2)}`,
    "",
    "Thank you for using our platform.",
  ].join("\n");
}

function buildHtml(order) {
  const clientName = order.clientUserId?.name || "Customer";
  const supermarketName = order.supermarketId?.name || "the supermarket";

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Order status updated</h2>
      <p>Hello <strong>${clientName}</strong>,</p>
      <p>Your order <strong>#${order._id}</strong> from <strong>${supermarketName}</strong> has changed status.</p>
      <p><strong>New status:</strong> ${getStatusLabel(order.status)}</p>
      <p><strong>Delivery method:</strong> ${order.deliveryMethod}</p>
      <p><strong>Order total:</strong> €${Number(order.finalTotal || 0).toFixed(2)}</p>
      <p>Thank you for using our platform.</p>
    </div>
  `;
}

async function sendOrderStatusEmail(orderId) {
  try {
    if (!isEmailEnabled()) {
      return { sent: false, reason: "disabled" };
    }

    const transporter = buildTransporter();

    if (!transporter) {
      console.log(
        "[emailService] Email not sent because SMTP is not configured.",
      );
      return { sent: false, reason: "smtp_not_configured" };
    }

    const order = await Order.findById(orderId)
      .populate("clientUserId", "name email")
      .populate("supermarketId", "name");

    if (!order) {
      return { sent: false, reason: "order_not_found" };
    }

    if (!order.clientUserId?.email) {
      return { sent: false, reason: "client_without_email" };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || "no-reply@paw.local",
      to: order.clientUserId.email,
      subject: buildSubject(order),
      text: buildText(order),
      html: buildHtml(order),
    };

    const info = await transporter.sendMail(mailOptions);

    if (isSimulationEnabled()) {
      console.log("[emailService] Simulated email payload:");
      console.log(
        typeof info.message === "string" ? info.message : JSON.stringify(mailOptions, null, 2),
      );
    }

    return {
      sent: true,
      messageId: info.messageId || null,
    };
  } catch (error) {
    console.error("[emailService] Failed to send order status email:", error.message);
    return { sent: false, reason: "send_failed", error: error.message };
  }
}

module.exports = {
  sendOrderStatusEmail,
};
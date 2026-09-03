// Vercel Serverless Function — /api/contact
// Receives Harmanwe website contact form submissions, validates them,
// and sends a transactional email via Resend (https://resend.com).
//
// Required Vercel environment variables (Project Settings → Environment Variables):
//   RESEND_API_KEY   — secret API key from your Resend account
//   CONTACT_TO_EMAIL — destination inbox, e.g. info@harmanwe.com
//   CONTACT_FROM     — verified sender, e.g. "Harmanwe Website <noreply@harmanwe.com>"
//                       (the sending domain must be verified in Resend; until then
//                       Resend's shared onboarding@resend.dev sender can be used for testing)
//
// No npm dependencies are required — this uses the built-in fetch API
// available in Vercel's Node.js runtime, so no package.json/build step is needed.

const MAX_LEN = {
  name: 120,
  email: 254,
  phone: 40,
  reason: 120,
  message: 5000,
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Strip CR/LF to prevent header injection if any field is ever reused in a header.
function sanitizeLine(str) {
  return String(str).replace(/[\r\n]+/g, " ").trim();
}

function isValidEmail(email) {
  // Practical, not fully RFC-exhaustive, validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async (req, res) => {
  // CORS is unnecessary for same-origin form posts, but respond cleanly to preflight
  // in case the form is ever called cross-origin.
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  let body = req.body;
  if (!body || typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Invalid request body." });
    }
  }

  const {
    name = "",
    email = "",
    phone = "",
    reason = "",
    message = "",
    company = "", // honeypot — real visitors never see or fill this field
    loadedAt = "", // timestamp (ms) the form was rendered, for basic bot timing check
  } = body;

  // --- Spam mitigation -----------------------------------------------------
  // 1) Honeypot: bots that fill every field will trip this. Pretend success.
  if (company && String(company).trim() !== "") {
    return res.status(200).json({ ok: true });
  }
  // 2) Timing trap: reject submissions completed implausibly fast (<3s),
  //    a common signature of automated form-fillers.
  const loadedAtMs = Number(loadedAt);
  if (loadedAtMs && Date.now() - loadedAtMs < 3000) {
    return res.status(400).json({ ok: false, error: "Submission rejected. Please try again." });
  }

  // --- Field validation ------------------------------------------------
  const errors = [];
  const cleanName = sanitizeLine(name).slice(0, MAX_LEN.name);
  const cleanEmail = sanitizeLine(email).slice(0, MAX_LEN.email);
  const cleanPhone = sanitizeLine(phone).slice(0, MAX_LEN.phone);
  const cleanReason = sanitizeLine(reason).slice(0, MAX_LEN.reason);
  const cleanMessage = String(message || "").slice(0, MAX_LEN.message).trim();

  if (!cleanName) errors.push("Full name is required.");
  if (!cleanEmail || !isValidEmail(cleanEmail)) errors.push("A valid email address is required.");
  if (!cleanMessage) errors.push("A message is required.");

  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors.join(" ") });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "info@harmanwe.com";
  const CONTACT_FROM = process.env.CONTACT_FROM;

  if (!RESEND_API_KEY || !CONTACT_FROM) {
    console.error("Contact form: missing RESEND_API_KEY or CONTACT_FROM environment variable.");
    return res.status(500).json({
      ok: false,
      error:
        "The contact form is not fully configured yet. Please email info@harmanwe.com directly in the meantime.",
    });
  }

  const subject = `Harmanwe Website Inquiry — ${cleanName}`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#152230;">
      <h2 style="color:#0069C2;margin:0 0 12px;">New Harmanwe Website Inquiry</h2>
      <p><strong>Name:</strong> ${escapeHtml(cleanName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(cleanEmail)}</p>
      ${cleanPhone ? `<p><strong>Phone:</strong> ${escapeHtml(cleanPhone)}</p>` : ""}
      ${cleanReason ? `<p><strong>Reason:</strong> ${escapeHtml(cleanReason)}</p>` : ""}
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-wrap;">${escapeHtml(cleanMessage)}</p>
    </div>
  `;

  try {
    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: [CONTACT_TO_EMAIL],
        reply_to: cleanEmail,
        subject,
        html,
      }),
    });

    if (!resendResp.ok) {
      const errText = await resendResp.text();
      console.error("Resend API error:", resendResp.status, errText);
      return res.status(502).json({
        ok: false,
        error: "Your message could not be sent right now. Please email info@harmanwe.com directly.",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact form send failure:", err);
    return res.status(500).json({
      ok: false,
      error: "Your message could not be sent right now. Please email info@harmanwe.com directly.",
    });
  }
};

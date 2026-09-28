export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    const requiredFields = ["bestelId", "koperNaam", "koperEmail", "gekoppeldLidNaam", "gekoppeldLidGroep", "totaalBedrag"];
    const missing = requiredFields.find(field => data[field] === undefined || data[field] === null || String(data[field]).trim() === "");

    if (missing) {
      return { statusCode: 400, body: JSON.stringify({ error: `Ontbrekende data: ${missing}` }) };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.koperEmail))) {
      return { statusCode: 400, body: JSON.stringify({ error: "Ongeldig e-mailadres" }) };
    }

    const escapeHtml = value => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

    const bestelId = escapeHtml(String(data.bestelId).trim());
    const koperNaam = escapeHtml(String(data.koperNaam).trim());
    const gekoppeldLidNaam = escapeHtml(String(data.gekoppeldLidNaam).trim());
    const gekoppeldLidGroep = escapeHtml(String(data.gekoppeldLidGroep).trim());
    const koperEmail = String(data.koperEmail).trim();
    const totaalBedrag = Number(data.totaalBedrag || 0);

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "RESEND_API_KEY ontbreekt" }) };
    }

    const emailHtml = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #2ecc71; padding-bottom: 10px;">Betaling ontvangen ✅</h2>
        <p>Beste <strong>${koperNaam}</strong>,</p>
        <p>We hebben je betaling voor bestelling <strong>${bestelId}</strong> goed ontvangen.</p>
        <p><strong>Bedrag:</strong> € ${totaalBedrag.toFixed(2)}</p>
        <p>Je bestelling staat nu als betaald geregistreerd. De wafels worden uitgedeeld tijdens de lessen van 	24 - 28 november</p>
        <p style="font-size: 0.9rem; color: #7f8c8d;">Steun je: ${gekoppeldLidNaam} (${gekoppeldLidGroep})</p>
        <p>Met sportieve groeten,<br>Turnkring Jong en Vrij Aartselaar</p>
      </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Turnkring Jong en Vrij <wafelverkoop@jongenvrij.be>",
        to: [koperEmail],
        bcc: ["kevinsamsungj5@gmail.com"],
        subject: `Betaling ontvangen voor bestelling ${bestelId}`,
        html: emailHtml
      })
    });

    const resendData = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: resendData?.message || "Mail verzenden mislukt" })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, resendId: resendData.id })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

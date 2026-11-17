const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

const escapeHtml = value => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

async function authenticateAdmin(event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization || "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return { error: jsonResponse(401, { error: "Inloggen is vereist." }) };

  const apiKey = process.env.FIREBASE_API_KEY;
  const allowedEmails = (process.env.WAFELMAIL_ADMIN_EMAILS || "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
  if (!apiKey || allowedEmails.length === 0) {
    return { error: jsonResponse(503, { error: "De beheerderstoegang voor e-mail is niet ingesteld in Netlify." }) };
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: tokenMatch[1] })
  });
  if (!response.ok) return { error: jsonResponse(401, { error: "Je sessie is ongeldig of verlopen." }) };

  const account = await response.json();
  const user = account.users?.[0];
  if (!user || user.disabled || !allowedEmails.includes(String(user.email || "").toLowerCase())) {
    return { error: jsonResponse(403, { error: "Dit account mag geen e-mails versturen." }) };
  }
  return { user };
}

export const handler = async event => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Alleen POST-verzoeken zijn toegestaan." });
  }

  try {
    const authentication = await authenticateAdmin(event);
    if (authentication.error) return authentication.error;

    const resendApiKey = process.env.RESEND_WAFELMAIL_API_KEY;
    if (!resendApiKey) {
      return jsonResponse(503, { error: "De Resend-verzendsleutel voor wafelmail is niet ingesteld in Netlify." });
    }

    let data;
    try {
      data = JSON.parse(event.body || "{}");
    } catch {
      return jsonResponse(400, { error: "Het verzoek bevat geen geldige JSON." });
    }

    const onderwerp = typeof data.onderwerp === "string" ? data.onderwerp.trim() : "";
    const bericht = typeof data.bericht === "string" ? data.bericht.trim() : "";
    if (!onderwerp || onderwerp.length > 150 || /[\r\n]/.test(onderwerp)) {
      return jsonResponse(400, { error: "Vul een geldig onderwerp van maximaal 150 tekens in." });
    }
    if (!bericht || bericht.length > 5000) {
      return jsonResponse(400, { error: "Vul een bericht van maximaal 5000 tekens in." });
    }
    if (!Array.isArray(data.adressen) || data.adressen.length === 0 || data.adressen.length > 100) {
      return jsonResponse(400, { error: "Een mailing moet 1 tot 100 ontvangers bevatten." });
    }

    const adressen = [...new Set(data.adressen.map(email =>
      typeof email === "string" ? email.trim().toLowerCase() : ""
    ))];
    if (adressen.some(email =>
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )) {
      return jsonResponse(400, { error: "De ontvangerslijst bevat een ongeldig e-mailadres." });
    }

    const veiligeBericht = escapeHtml(bericht).replace(/\r?\n/g, "<br>");
    const html = `
      <div style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
        <div style="background:#2c3e50;padding:22px 24px">
          <h1 style="margin:0;color:#fff;font-size:22px">Turnkring Jong en Vrij</h1>
        </div>
        <div style="padding:24px;line-height:1.6">
          <p>Beste,</p>
          <p>${veiligeBericht}</p>
          <p style="margin-top:28px">Met sportieve groeten,<br><strong>Turnkring Jong en Vrij Aartselaar</strong></p>
        </div>
        <div style="height:4px;background:#e67e22"></div>
      </div>
    `;
    const emails = adressen.map(to => ({
      from: "Turnkring Jong en Vrij <wafelverkoop@jongenvrij.be>",
      to: [to],
      subject: onderwerp,
      html
    }));

    const resendResponse = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emails)
    });

    let resendResult;
    try {
      resendResult = await resendResponse.json();
    } catch {
      resendResult = null;
    }
    if (!resendResponse.ok) {
      console.error("Resend rejected wafel mailing", { status: resendResponse.status });
      return jsonResponse(502, { error: "Resend heeft de mailing geweigerd. Controleer de Resend-instellingen." });
    }
    const verzonden = Array.isArray(resendResult?.data)
      ? resendResult.data.filter(result => result && result.id).length
      : 0;
    if (verzonden !== emails.length) {
      return jsonResponse(502, {
        error: "Resend bevestigde niet alle e-mails. Controleer de verzendresultaten in Resend voordat je opnieuw probeert.",
        verzonden
      });
    }

    return jsonResponse(200, { success: true, verzonden });
  } catch (error) {
    console.error("Wafel mailing failed", error);
    return jsonResponse(500, { error: "Er trad een fout op bij het versturen van de mailing." });
  }
};

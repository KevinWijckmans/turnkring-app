export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const productNamen = {
      vanille: "Vanillewafels",
      choco_wafel: "Vanillewafels met Chocolade",
      wafelmix: "Wafelmix",
      truffels: "Chocoladetruffels",
      zeevruchten: "Chocolade Zeevruchten",
      marsepein: "Marsepein",
      frangipane: "Frangipane (12 stuks)"
    };
    const verplichteVelden = ["bestelId", "koperNaam", "koperEmail", "gekoppeldLidNaam", "gekoppeldLidGroep"];

    if (verplichteVelden.some(veld => typeof data[veld] !== "string" || data[veld].trim() === "")) {
      return { statusCode: 400, body: "Ongeldige bestelling" };
    }
    if (!/^WAFEL-\d{4}-\d{4}$/.test(data.bestelId) || data.bestelId.length > 32) {
      return { statusCode: 400, body: "Ongeldig bestelnummer" };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.koperEmail) || data.koperEmail.length > 254) {
      return { statusCode: 400, body: "Ongeldig e-mailadres" };
    }
    if (!Number.isFinite(data.totaalBedrag) || data.totaalBedrag <= 0 || data.totaalBedrag > 10000) {
      return { statusCode: 400, body: "Ongeldig bedrag" };
    }
    if (!data.aantallen || typeof data.aantallen !== "object") {
      return { statusCode: 400, body: "Ongeldige aantallen" };
    }
    let totaalAantal = 0;
    for (const [key, qty] of Object.entries(data.aantallen)) {
      if (!Object.hasOwn(productNamen, key) || !Number.isInteger(qty) || qty < 0 || qty > 1000) {
        return { statusCode: 400, body: "Ongeldige productgegevens" };
      }
      totaalAantal += qty;
    }
    const verwachtBedrag = totaalAantal * 3;
    if (totaalAantal === 0 || Math.round(data.totaalBedrag * 100) !== verwachtBedrag * 100) {
      return { statusCode: 400, body: "Bedrag komt niet overeen met de bestelling" };
    }

    const escapeHtml = value => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

    const veiligeData = {
      ...data,
      bestelId: escapeHtml(data.bestelId.trim()),
      koperNaam: escapeHtml(data.koperNaam.trim()),
      koperEmail: data.koperEmail.trim(),
      gekoppeldLidNaam: escapeHtml(data.gekoppeldLidNaam.trim()),
      gekoppeldLidGroep: escapeHtml(data.gekoppeldLidGroep.trim())
    };
    
    //  Resend API key halen uit Netlify
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    // overzichtvan de bestelde producten voor in de mail
    let productenLijstHtml = "";
    for (const [key, qty] of Object.entries(data.aantallen)) {
      if (qty > 0) {
        productenLijstHtml += `<li>${productNamen[key] || key}: <strong>${qty}x</strong></li>`;
      }
    }

    const betalingsmededeling = `${veiligeData.bestelId} - ${veiligeData.koperNaam}`.slice(0, 140);

    // De e-mail opbouwen in HTML
    const emailHtml = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Wafelverkoop Turnkring Jong en Vrij 🧇</h2>
        <p>Beste <strong>${veiligeData.koperNaam}</strong>,</p>
        <p>Hartelijk dank voor je bestelling! We hebben deze goed ontvangen onder bestelnummer <strong>${veiligeData.bestelId}</strong>.</p>
        
        <h3 style="color: #2c3e50;">Overzicht van je bestelling:</h3>
        <ul>
          ${productenLijstHtml}
        </ul>
        <p><strong>Totaalbedrag: € ${data.totaalBedrag.toFixed(2)}</strong></p>
        <p style="font-size: 0.9rem; color: #7f8c8d;">Je steunt hiermee turner/turnster: ${veiligeData.gekoppeldLidNaam} (${veiligeData.gekoppeldLidGroep})</p>
        
        <div style="background: #f8f9fa; border: 1px dashed #ccc; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #e67e22;">Betalingsinstructies:</h3>
          <p style="margin: 5px 0;"><strong>Te betalen:</strong> € ${data.totaalBedrag.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Bankrekening (IBAN):</strong> BE86 3632 0190 6550</p>
          <p style="margin: 5px 0;"><strong>Op naam van:</strong> SPORT EN TURNVERENIGING JONG EN VRIJ VZW</p>
          <p style="margin: 5px 0;"><strong>Mededeling (VERPLICHT!):</strong> <span style="background: #f1c40f; padding: 2px 6px; font-weight: bold; border-radius:3px;">${betalingsmededeling}</span></p>
        </div>

        <p style="font-size: 0.9rem; color: #7f8c8d;"><i>Je bestelling is definitief zodra we de betaling hebben ontvangen.</i></p>
        <p>Met sportieve groeten,<br>Turnkring Jong en Vrij Aartselaar</p>
      </div>
    `;

    // Verstuur de mail via de Resend API naar -> koper
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Turnkring Jong en Vrij <wafelverkoop@jongenvrij.be>", 
        to: [data.koperEmail],
        bcc: ["kevinsamsungj5@gmail.com"],  
        subject: `Bevestiging wafelbestelling ${veiligeData.bestelId}`,
        html: emailHtml
      })
    });

    const resendData = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, resendId: resendData.id })
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
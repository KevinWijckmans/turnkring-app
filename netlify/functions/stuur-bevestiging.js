export const handler = async (event) => {
  // Controleer of het een POST-request is
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Jouw geheime Resend API key halen we dadelijk veilig uit Netlify
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    // We bouwen een overzichtje van de bestelde producten voor in de mail
    let productenLijstHtml = "";
    const productNamen = {
      vanille: "Vanillewafels",
      choco_wafel: "Vanillewafels met Chocolade",
      wafelmix: "Wafelmix",
      truffels: "Chocoladetruffels",
      zeevruchten: "Chocolade Zeevruchten",
      marsepein: "Marsepein",
      frangipane: "Frangipane (12 stuks)"
    };

    for (const [key, qty] of Object.entries(data.aantallen)) {
      if (qty > 0) {
        productenLijstHtml += `<li>${productNamen[key] || key}: <strong>${qty}x</strong></li>`;
      }
    }

    // De e-mail opbouwen in HTML
    const emailHtml = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">Wafelverkoop Turnkring Jong en Vrij 🧇</h2>
        <p>Beste <strong>${data.koperNaam}</strong>,</p>
        <p>Hartelijk dank voor je bestelling! We hebben deze goed ontvangen onder bestelnummer <strong>${data.bestelId}</strong>.</p>
        
        <h3 style="color: #2c3e50;">Overzicht van je bestelling:</h3>
        <ul>
          ${productenLijstHtml}
        </ul>
        <p><strong>Totaalbedrag: € ${data.totaalBedrag.toFixed(2)}</strong></p>
        <p style="font-size: 0.9rem; color: #7f8c8d;">Je steunt hiermee turner/turnster: ${data.gekoppeldLidNaam} (${data.gekoppeldLidGroep})</p>
        
        <div style="background: #f8f9fa; border: 1px dashed #ccc; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #e67e22;">Betalingsinstructies:</h3>
          <p style="margin: 5px 0;"><strong>Te betalen:</strong> € ${data.totaalBedrag.toFixed(2)}</p>
          <p style="margin: 5px 0;"><strong>Bankrekening (IBAN):</strong> BE86 3632 0190 6550</p>
          <p style="margin: 5px 0;"><strong>Op naam van:</strong> Turnkring Jong en Vrij</p>
          <p style="margin: 5px 0;"><strong>Mededeling (VERPLICHT!):</strong> <span style="background: #f1c40f; padding: 2px 6px; font-weight: bold; border-radius:3px;">${data.bestelId}</span></p>
        </div>

        <p style="font-size: 0.9rem; color: #7f8c8d;"><i>Je bestelling is definitief zodra we de betaling hebben ontvangen.</i></p>
        <p>Met sportieve groeten,<br>Turnkring Jong en Vrij Aartselaar</p>
      </div>
    `;

    // Verstuur de mail via de Resend API naar de koper én in BCC naar jezelf (optioneel)
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Turnkring Jong en Vrij <wafelverkoop@jongenvrij.be>", // Pas dit aan naar je gewenste naam/adres
        to: [data.koperEmail],
        bcc: ["eddy.vinck@skynet.be"], // Zo krijg je zelf ook een kopie per bestelling
        subject: `Bevestiging wafelbestelling ${data.bestelId}`,
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
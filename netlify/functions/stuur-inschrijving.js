export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    // Prachtige HTML e-mail voor het nieuwe lid / de ouders
    const emailHtml = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #e74c3c; padding-bottom: 10px;">Welkom bij Turnkring Jong en Vrij! 🤸‍♂️✨</h2>
        <p>Beste ouders / turn(ster),</p>
        <p>We hebben de inschrijving voor <strong>${data.voornaam} ${data.naam}</strong> in goede orde ontvangen. Welkom bij onze club!</p>
        
        <h3 style="color: #2c3e50; margin-top: 20px;">Geregistreerde gegevens:</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr><td style="padding: 5px 0; width: 150px;"><strong>Groep:</strong></td><td>${data.groep}</td></tr>
          <tr><td style="padding: 5px 0;"><strong>Geboortedatum:</strong></td><td>${data.geboortedatum}</td></tr>
          <tr><td style="padding: 5px 0;"><strong>Adres:</strong></td><td>${data.adres}, ${data.gemeente}</td></tr>
          <tr><td style="padding: 5px 0;"><strong>Telefoon:</strong></td><td>${data.tel1} ${data.tel2 ? '/ ' + data.tel2 : ''}</td></tr>
        </table>

        <div style="background: #f8f9fa; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0; color: #2c3e50;">Wat gebeurt er nu?</h4>
          <p style="margin: 0; font-size: 0.95rem;">Onze leiding kijkt ernaar uit om ${data.voornaam} te verwelkomen in de les! Informatie over het lidgeld en eventuele praktische updates sturen we binnenkort via een aparte e-mail naar dit adres.</p>
        </div>

        <p style="font-size: 0.9rem; color: #7f8c8d;">Heb je nog vragen? Bezoek onze website of neem contact met ons op.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p>Met sportieve groeten,<br><strong>Turnkring Jong en Vrij Aartselaar</strong></p>
      </div>
    `;

    // Verzenden via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Turnkring Jong en Vrij <inschrijvingen@jongenvrij.be>", // Of info@jongenvrij.be
        to: [data.email1],
        bcc: ["kevinsamsungj5@gmail.com"], // Optioneel: kopie naar jezelf
        subject: `Bevestiging inschrijving: ${data.voornaam} ${data.naam}`,
        html: emailHtml
      })
    });

    const resendData = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: resendData.id })
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

let transporter = null;

// Initialize Ethereal Email (Fake SMTP for development)
nodemailer.createTestAccount((err, account) => {
  if (err) {
    console.error('[EmailService] Failed to create test account:', err.message);
    return;
  }
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  console.log('[EmailService] Ready. Ethereal account created.');
});

/**
 * Sends a reservation confirmation email with QR code.
 *
 * Issue #3 fix: This function NEVER throws — it returns { success, qrData, error? }.
 * The caller decides what to do with email failures; the reservation approval is
 * not rolled back regardless of email outcome.
 *
 * @param {object} reservation - Reservation record from DB
 * @returns {Promise<{ success: boolean, qrData: string|null, error?: string }>}
 */
async function sendReservationConfirmation(reservation) {
  // Generate QR payload regardless of transporter state
  const qrData = `PARK_RES_${reservation.id}_${reservation.slot}_${reservation.date}`;

  if (!transporter) {
    console.warn('[EmailService] Transporter not ready — email skipped, QR still generated.');
    return { success: false, qrData, error: 'Transporter not ready' };
  }

  if (!reservation.email) {
    console.warn('[EmailService] No email for reservation:', reservation.id);
    return { success: false, qrData, error: 'No email address' };
  }

  try {
    const qrImage = await QRCode.toDataURL(qrData);

    const mailOptions = {
      from: '"ParkSystem Admin" <admin@parksystem.com>',
      to: reservation.email,
      subject: `Parking Reservation Confirmed — ${reservation.date}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background:#f9f9f9; padding: 24px; border-radius: 12px;">
          <div style="background:#1a1a2e; color:#fff; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <h2 style="margin:0;">🅿️ ParkSystem</h2>
            <p style="margin:4px 0 0; opacity:0.7; font-size:13px;">Smart Parking Reservation System</p>
          </div>
          <h3 style="color:#1a1a2e;">Your Reservation is Confirmed!</h3>
          <p>Hi <strong>${reservation.name}</strong>,</p>
          <p>Your parking reservation has been approved. Please show the QR code below at the security gate.</p>
          <table style="width:100%; background:#fff; border-radius:8px; padding:16px; margin:16px 0; border: 1px solid #e0e0e0;">
            <tr><td style="color:#666; font-size:13px;">📅 Date</td><td><strong>${reservation.date}</strong></td></tr>
            <tr><td style="color:#666; font-size:13px;">⏰ Time</td><td><strong>${reservation.time}</strong></td></tr>
            <tr><td style="color:#666; font-size:13px;">🚗 Slot</td><td><strong>${reservation.slot}</strong></td></tr>
            <tr><td style="color:#666; font-size:13px;">🔑 Ref ID</td><td><strong>#${reservation.id}</strong></td></tr>
          </table>
          <div style="text-align:center; padding:16px;">
            <p style="color:#666; font-size:13px; margin-bottom:12px;">Present this QR code at the gate:</p>
            <img src="${qrImage}" alt="Reservation QR Code" style="width:200px; height:200px; border:2px solid #e0e0e0; border-radius:8px;" />
          </div>
          <p style="font-size:12px; color:#999; border-top:1px solid #e0e0e0; padding-top:16px; margin-top:24px;">
            Thank you for using ParkSystem.<br/>This is an automated email — please do not reply.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[EmailService] Message sent:', info.messageId);
    console.log('[EmailService] Preview URL:', nodemailer.getTestMessageUrl(info));
    return { success: true, qrData };
  } catch (err) {
    console.error('[EmailService] Failed to send email:', err.message);
    return { success: false, qrData, error: err.message };
  }
}

module.exports = { sendReservationConfirmation };

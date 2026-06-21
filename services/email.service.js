const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'email-smtp.us-east-1.amazonaws.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

async function sendOTPEmail(toEmail, fullName, otp) {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || 'ACEAS System <info@hsmdhopes.org>';

  const mailOptions = {
    from,
    to: toEmail,
    subject: 'Your ACEAS Login Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>ACEAS OTP</title>
      </head>
      <body style="font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #0d6efd; margin: 0;">ACEAS</h1>
            <p style="color: #6c757d; margin: 5px 0 0;">AI Compliance and Ethics Assessment System</p>
          </div>
          <h2 style="color: #212529; margin-bottom: 10px;">Login Verification Code</h2>
          <p style="color: #495057;">Hello ${fullName},</p>
          <p style="color: #495057;">Use the following verification code to complete your login:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #f8f9fa; border: 2px dashed #0d6efd; border-radius: 8px; padding: 20px; display: inline-block;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0d6efd;">${otp}</span>
            </div>
          </div>
          <p style="color: #6c757d; font-size: 14px;">This code expires in <strong>${process.env.OTP_EXPIRY_MINUTES || 5} minutes</strong>.</p>
          <p style="color: #6c757d; font-size: 14px;">If you did not request this code, please ignore this email and your account will remain secure.</p>
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
          <p style="color: #adb5bd; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} ACEAS — AI Compliance and Ethics Assessment System</p>
        </div>
      </body>
      </html>
    `,
    text: `Hello ${fullName},\n\nYour ACEAS verification code is: ${otp}\n\nThis code expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.\n\nIf you did not request this, please ignore this email.`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return { success: true };
  } catch (err) {
    console.error('Failed to send OTP email:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendReviewNotification(toEmail, fullName, projectTitle, decision, comments) {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || 'ACEAS System <info@hsmdhopes.org>';

  const decisionColor = decision === 'approved' ? '#198754' : decision === 'rejected' ? '#dc3545' : '#fd7e14';
  const decisionLabel = decision === 'approved' ? 'Approved ✅' : decision === 'rejected' ? 'Rejected ❌' : 'Changes Requested ⚠️';

  const mailOptions = {
    from,
    to: toEmail,
    subject: `ACEAS: Project Review Update — ${projectTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px;">
        <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h1 style="color: #0d6efd;">ACEAS</h1>
          <h2 style="color: #212529;">Project Review Update</h2>
          <p>Hello ${fullName},</p>
          <p>Your project <strong>${projectTitle}</strong> has been reviewed.</p>
          <div style="background: #f8f9fa; border-left: 4px solid ${decisionColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <strong style="color: ${decisionColor}; font-size: 18px;">Decision: ${decisionLabel}</strong>
            ${comments ? `<p style="margin: 10px 0 0; color: #495057;">${comments}</p>` : ''}
          </div>
          <p style="color: #6c757d; font-size: 14px;">Log in to ACEAS to view full details and take any required action.</p>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    console.error('Failed to send review notification:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendOTPEmail, sendReviewNotification };

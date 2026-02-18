/**
 * Generates Ethereal test SMTP credentials for development.
 * Run: node scripts/setup-smtp-ethereal.js
 * Copy the output lines into backend/.env (replace SMTP_USER and SMTP_PASS).
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  const account = await nodemailer.createTestAccount();
  console.log('\n=== SMTP Ethereal credentials (copy to .env) ===\n');
  console.log('SMTP_HOST=smtp.ethereal.email');
  console.log('SMTP_PORT=587');
  console.log('SMTP_SECURE=false');
  console.log(`SMTP_USER=${account.user}`);
  console.log(`SMTP_PASS=${account.pass}`);
  console.log('MAIL_FROM=noreply@tbidder.com');
  console.log('\n=== Emails won\'t be delivered but you can view them at: ===');
  console.log('https://ethereal.email/login');
  console.log(`User: ${account.user}\n`);
}

main().catch(console.error);

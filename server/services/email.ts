import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailConfig {
  from: string;
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@sentivox.com';
    this.initialize();
  }

  private initialize() {
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    // Auto-detect SMTP server based on email domain
    let emailHost = process.env.EMAIL_HOST;
    if (!emailHost && emailUser) {
      if (emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com') || emailUser.includes('@live.com')) {
        emailHost = 'smtp-mail.outlook.com';
      } else {
        emailHost = 'smtp.gmail.com';
      }
    }
    emailHost = emailHost || 'smtp.gmail.com';
    
    const emailPort = parseInt(process.env.EMAIL_PORT || '587');

    console.log(`📧 Email Config Check - User: ${emailUser ? 'SET' : 'NOT SET'}, Password: ${emailPassword ? 'SET' : 'NOT SET'}`);

    if (!emailPassword || !emailUser) {
      console.warn('⚠️  EMAIL_PASSWORD or EMAIL_USER not set. Email sending will be simulated.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      console.log(`✅ Email service initialized successfully (${emailHost}:${emailPort})`);
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  async sendPasswordSetupEmail(email: string, token: string): Promise<void> {
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : (process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : `http://localhost:${process.env.PORT || 5000}`);
    
    const setupLink = `${baseUrl}/setup-password?token=${token}&email=${encodeURIComponent(email)}`;
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📧 PASSWORD SETUP LINK FOR: ${email}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\n🔗 CLICK HERE TO SET PASSWORD:\n`);
    console.log(`   ${setupLink}\n`);
    console.log(`${'='.repeat(70)}\n`);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #000000; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 2px solid #06b6d4; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); padding: 30px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; }
          .content { padding: 40px 30px; }
          .content p { line-height: 1.6; color: #d1d5db; margin-bottom: 20px; }
          .button { display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; }
          .button:hover { opacity: 0.9; }
          .info-box { background: #1a1a1a; border: 1px solid #374151; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .footer { background: #0a0a0a; padding: 20px; text-align: center; border-top: 1px solid #374151; }
          .footer p { color: #6b7280; font-size: 12px; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎙️ Welcome to Sentivox</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>Welcome to <strong>Sentivox</strong> - your AI-powered voice analysis platform!</p>
            <p>To get started, you need to set up your password. Click the button below to create your secure password:</p>
            
            <div style="text-align: center;">
              <a href="${setupLink}" class="button">Set Your Password</a>
            </div>
            
            <div class="info-box">
              <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                <strong>⏱️ Important:</strong> This link expires in 24 hours for your security.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #9ca3af;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #06b6d4; font-size: 12px;">${setupLink}</p>
            
            <p style="margin-top: 30px; font-size: 14px; color: #9ca3af;">
              If you didn't request this email, please ignore it. Your account has not been created yet.
            </p>
          </div>
          <div class="footer">
            <p>© 2025 Sentivox • AI-Powered Interview Analysis</p>
            <p>Authorized personnel only • Secured by Encryption</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Set Your Sentivox Password 🔐',
      html,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const baseUrl = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : (process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : `http://localhost:${process.env.PORT || 5000}`);
    
    const resetLink = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔐 PASSWORD RESET LINK FOR: ${email}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\n🔗 CLICK HERE TO RESET PASSWORD:\n`);
    console.log(`   ${resetLink}\n`);
    console.log(`${'='.repeat(70)}\n`);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #000000; color: #ffffff; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 2px solid #06b6d4; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); padding: 30px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; }
          .content { padding: 40px 30px; }
          .content p { line-height: 1.6; color: #d1d5db; margin-bottom: 20px; }
          .button { display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0; }
          .button:hover { opacity: 0.9; }
          .info-box { background: #1a1a1a; border: 1px solid #374151; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .footer { background: #0a0a0a; padding: 20px; text-align: center; border-top: 1px solid #374151; }
          .footer p { color: #6b7280; font-size: 12px; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset your password for your <strong>Sentivox</strong> account.</p>
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Your Password</a>
            </div>
            
            <div class="info-box">
              <p style="margin: 0; color: #9ca3af; font-size: 14px;">
                <strong>⏱️ Important:</strong> This link expires in 1 hour for your security.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #9ca3af;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #06b6d4; font-size: 12px;">${resetLink}</p>
            
            <p style="margin-top: 30px; font-size: 14px; color: #9ca3af;">
              If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
            </p>
          </div>
          <div class="footer">
            <p>© 2025 Sentivox • AI-Powered Interview Analysis</p>
            <p>Authorized personnel only • Secured by Encryption</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Sentivox Password 🔑',
      html,
    });
  }

  private async sendEmail(config: Omit<EmailConfig, 'from'>): Promise<void> {
    if (!this.transporter) {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║          EMAIL (Development Mode - No Credentials)         ║
╠════════════════════════════════════════════════════════════╣
║ To: ${config.to.padEnd(54)}║
║ Subject: ${config.subject.padEnd(48)}║
║                                                            ║
║ ⚠️  Email sending is simulated. Set EMAIL_PASSWORD env    ║
║    variable to enable actual email delivery.              ║
╚════════════════════════════════════════════════════════════╝
      `);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: config.to,
        subject: config.subject,
        html: config.html,
      });

      console.log(`✅ Email sent successfully to ${config.to}`);
      console.log(`   Message ID: ${info.messageId}`);
    } catch (error) {
      console.error(`❌ Failed to send email to ${config.to}:`, error);
      
      // Fallback to console logging
      console.log(`
╔════════════════════════════════════════════════════════════╗
║          EMAIL (Fallback - SMTP Failed)                    ║
╠════════════════════════════════════════════════════════════╣
║ To: ${config.to.padEnd(54)}║
║ Subject: ${config.subject.padEnd(48)}║
║                                                            ║
║ ⚠️  Email sending failed.                                 ║
║                                                            ║
║ 💡 SOLUTION: Generate a Gmail App Password                ║
║    1. Go to: https://myaccount.google.com/security        ║
║    2. Enable 2-Step Verification                          ║
║    3. Go to "App passwords" section                       ║
║    4. Generate new app password                           ║
║    5. Update EMAIL_PASSWORD in Replit Secrets             ║
║                                                            ║
║ 📋 The setup/reset link is shown above in console         ║
╚════════════════════════════════════════════════════════════╝
      `);
    }
  }
}

export const emailService = new EmailService();

import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private currentConfig: SmtpConfig;
  private dbLoaded = false;

  constructor() {
    this.currentConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM || 'OES Notifications <no-reply@oes.local>',
    };
    this.initTransporter();
  }

  public async ensureConfigLoaded(): Promise<void> {
    if (this.dbLoaded) return;
    try {
      const { db } = await import('@/db/client');
      const { systemSettings } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const [record] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'smtp_config'))
        .limit(1);

      if (record && record.value) {
        const saved = JSON.parse(record.value);
        if (saved && saved.host && saved.port) {
          this.updateConfig(saved);
        }
      }
      this.dbLoaded = true;
    } catch (err: any) {
      // Database not ready or table empty; proceed with env defaults
      console.warn('[EmailService] Database SMTP config read deferred, using env config:', err?.message);
    }
  }

  private initTransporter() {
    this.transporter = nodemailer.createTransport({
      host: this.currentConfig.host,
      port: this.currentConfig.port,
      secure: this.currentConfig.port === 465,
      auth: this.currentConfig.user ? { user: this.currentConfig.user, pass: this.currentConfig.pass } : undefined,
      connectionTimeout: 8000,
    });
  }

  public updateConfig(config: Partial<SmtpConfig>) {
    this.currentConfig = { ...this.currentConfig, ...config };
    process.env.SMTP_HOST = this.currentConfig.host;
    process.env.SMTP_PORT = String(this.currentConfig.port);
    if (this.currentConfig.user) process.env.SMTP_USER = this.currentConfig.user;
    if (this.currentConfig.pass) process.env.SMTP_PASS = this.currentConfig.pass;
    if (this.currentConfig.from) process.env.SMTP_FROM = this.currentConfig.from;
    this.dbLoaded = true;
    this.initTransporter();
  }

  public getConfig(): SmtpConfig {
    return { ...this.currentConfig };
  }

  private resolveFromAddress(): string {
    let from = this.currentConfig.from?.trim();
    // If from is empty or still the default local placeholder, but an authenticated email username is provided (e.g. Gmail),
    // align the From header with the authenticated sender to prevent SMTP 553 / 554 rejection
    if (!from || from.includes('@oes.local')) {
      if (this.currentConfig.user && this.currentConfig.user.includes('@')) {
        return `OES Notifications <${this.currentConfig.user}>`;
      }
      return 'OES Notifications <no-reply@oes.local>';
    }
    return from;
  }

  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
    await this.ensureConfigLoaded();
    const from = this.resolveFromAddress();

    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });
        console.log(`✉️ [Email Sent] to=${options.to} subject="${options.subject}" id=${info.messageId}`);
        return { success: true, messageId: info.messageId };
      }
    } catch (error: any) {
      console.warn(`[Email Error] Failed via SMTP (${this.currentConfig.host}:${this.currentConfig.port}) to ${options.to}:`, error);
      throw new Error(`SMTP Error (${this.currentConfig.host}:${this.currentConfig.port}): ${error.message}`);
    }

    // Dev Fallback
    console.log(`✉️ [DEV EMAIL LOG] To: ${options.to}\nSubject: ${options.subject}\nContent:\n${options.text || options.html}`);
    return { success: true, messageId: `dev_${Date.now()}` };
  }

  async sendInvitationEmail(to: string, employeeName: string, activationUrl: string): Promise<boolean> {
    const subject = 'Welcome to OES - Activate Your Account';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">Welcome to the Overtime & Expense System</h2>
        <p style="color: #475569; line-height: 1.5;">Hello ${employeeName},</p>
        <p style="color: #475569; line-height: 1.5;">An account has been created for you on the company OT & Expense platform. Please click the button below to set your password and activate your account:</p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${activationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Activate Account</a>
        </div>
        <p style="color: #64748b; font-size: 13px;">If the button above does not work, copy and paste this URL into your browser:</p>
        <p style="color: #64748b; font-size: 12px; word-break: break-all;">${activationUrl}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">This is an automated message. Please do not reply to this email.</p>
      </div>
    `;

    const res = await this.sendEmail({
      to,
      subject,
      html,
      text: `Hello ${employeeName},\n\nPlease activate your account by visiting: ${activationUrl}`,
    });

    return res.success;
  }

  async sendPasswordResetEmail(to: string, employeeName: string, resetUrl: string): Promise<boolean> {
    const subject = 'Reset Your OES Password';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">Password Reset Request</h2>
        <p style="color: #475569; line-height: 1.5;">Hello ${employeeName},</p>
        <p style="color: #475569; line-height: 1.5;">A password reset was requested for your account on the Overtime & Expense System. Please click the button below to set a new password:</p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 13px;">This link is valid for 24 hours. If you did not request this change, please ignore this email or notify your system administrator.</p>
        <p style="color: #64748b; font-size: 12px; word-break: break-all;">${resetUrl}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">This is an automated message. Please do not reply to this email.</p>
      </div>
    `;

    const res = await this.sendEmail({
      to,
      subject,
      html,
      text: `Hello ${employeeName},\n\nYou can reset your password by visiting: ${resetUrl}\n\nThis link is valid for 24 hours.`,
    });

    return res.success;
  }
}

export const emailService = new EmailService();

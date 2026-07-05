import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name); // Logger dedicado para rastrear operações de email.
  private transporter: nodemailer.Transporter; // Transportador do Nodemailer para enviar emails.
  
  constructor(private readonly configService: ConfigService) {
    // Configura o transportador SMTP usando variáveis de ambiente para segurança e flexibilidade.
    this.transporter = nodemailer.createTransport({
      service: 'gmail', // Exemplo usando Gmail; pode ser configurado para outros serviços ou SMTP personalizado.
      auth: {
        user: this.configService.get<string>('EMAIL_USER'), // Email do remetente, definido em .env.
        pass: this.configService.get<string>('EMAIL_PASS'), // Senha ou token de app, definido em .env.
      },
    });
  }

  async sendFeedbackEmail(name: string, email: string, title: string, message: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('EMAIL_USER'),
      to: 'mwsilva.contato@gmail.com',
      replyTo: email,
      subject: `[Feedback] ${title} — from ${name}`,
      html: `
        <h2>${title}</h2>
        <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });
    this.logger.log(`Feedback email sent from ${email}`);
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('EMAIL_USER'),
      to,
      
      subject: 'Account Verification - Your OTP Code',

      html: `
        <h2>Welcome to Deepthought</h2>

        <p>Your OTP code is:</p>

        <h1>${code}</h1>

        <p>This code will expire in 10 minutes.</p>
      `,
    });

    this.logger.log(`OTP sent to ${to}`);
  }
}

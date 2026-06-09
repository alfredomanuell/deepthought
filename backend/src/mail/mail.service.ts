import { Injectable, Logger } from '@nestjs/common';

/**
 * Serviço reutilizável para centralizar o envio de emails da aplicação.
 *
 * Neste momento não há uma dependência SMTP instalada no projecto, por isso o
 * método regista o email no logger. Quando existir um provider real, este é o
 * único ponto que precisa de mudar.
 */
@Injectable()
export class MailService {
  /** Logger dedicado para mensagens relacionadas com envio de email. */
  private readonly logger = new Logger(MailService.name);

  /**
   * Envia o email com o OTP de primeiro login.
   *
   * @param to Email da conta 42 que vai receber o código.
   * @param code Código de 6 dígitos gerado com `crypto.randomInt`.
   */
  async sendOtpEmail(to: string, code: string): Promise<void> {
    /** Assunto fixo pedido para a verificação da conta. */
    const subject = 'Verificação da conta';

    /** Corpo simples e explícito para o utilizador copiar o código. */
    const body = [
      'O seu código de verificação é:',
      '',
      code,
      '',
      'Este código expira em 10 minutos.',
    ].join('\n');

    /** Ponto único onde um transporte SMTP/API externa deve ser ligado. */
    this.logger.log(`Sending OTP email to ${to}: ${subject}\n${body}`);
  }
}

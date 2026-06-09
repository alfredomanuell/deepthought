import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Módulo que exporta o serviço de email para outros módulos NestJS. */
@Module({
  /** Provider reutilizável para qualquer fluxo que precise enviar email. */
  providers: [MailService],
  /** Exporta o provider para permitir injecção por dependência noutros módulos. */
  exports: [MailService],
})
export class MailModule {}

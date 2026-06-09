import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from '../../mail/mail.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { OtpController } from './otp.controller';
import { OtpService } from './otp.service';

/** Módulo isolado do OTP de primeiro login. */
@Module({
  imports: [
    /** Prisma permite consultar e actualizar os campos OTP do User. */
    PrismaModule,
    /** MailModule fornece o envio reutilizável do código por email. */
    MailModule,
    /** JwtModule assina tokens depois do OTP ser validado. */
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  /** Controller expõe apenas POST /auth/otp/verify. */
  controllers: [OtpController],
  /** Service contém geração, envio, validação, limpeza e emissão de tokens. */
  providers: [OtpService],
  /** Exporta OtpService para o AuthService iniciar o OTP após OAuth. */
  exports: [OtpService],
})
export class OtpModule {}

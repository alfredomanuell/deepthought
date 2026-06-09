import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { FortyTwoStrategy } from './strategies/forty-two.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { SyncModule } from '../sync/sync.module';
import { FortyTwoModule } from '../integrations/fortytwo/fortytwo.module';
import { OtpModule } from './otp/otp.module';

/**
 * Módulo de autenticação.
 * Configura o Passport com as estratégias OAuth2 (42) e JWT.
 * Depende do UsersModule, SyncModule e FortyTwoModule.
 */
@Module({
  imports: [
    PrismaModule,
    UsersModule,
    SyncModule,
    FortyTwoModule,
    OtpModule,
    PassportModule,
    // Configuração assíncrona do JWT usando ConfigService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FortyTwoStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}

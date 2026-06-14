import 'dotenv/config';
import { setDefaultResultOrder } from 'dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  /**
   * A API da 42/Cloudflare pode devolver IPv6 primeiro em alguns ambientes Docker.
   * Como o log mostrou ENETUNREACH em IPv6, preferimos IPv4 sem desactivar IPv6 globalmente.
   */
  setDefaultResultOrder('ipv4first');

  const app = await NestFactory.create(AppModule);

  /**
   * O frontend Vite chama o backend por origem diferente durante OAuth/OTP.
   * Sem CORS, o browser bloqueia POST /auth/otp/verify e o React cai em "Server error".
   */
  app.enableCors({
    origin: buildCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}

/** Monta a allowlist de origens do frontend para dev local, ngrok e Docker. */
function buildCorsOrigins(): string[] {
  /** FRONTEND_URL é o destino usado no redirect OAuth -> React. */
  const frontendUrl = process.env.FRONTEND_URL;

  /** CORS_ORIGINS permite acrescentar domínios separados por vírgula sem mexer no código. */
  const configuredOrigins =
    process.env.CORS_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  /** Defaults seguros para o Vite local usado no projecto. */
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(frontendUrl ? [frontendUrl] : []),
    ...configuredOrigins,
  ];
}

bootstrap();

import 'dotenv/config';
import { setDefaultResultOrder } from 'dns';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { buildCorsOrigins } from './common/cors-origins.util';
import { join } from 'path';

async function bootstrap() {
  /**
   * A API da 42/Cloudflare pode devolver IPv6 primeiro em alguns ambientes Docker.
   * Como o log mostrou ENETUNREACH em IPv6, preferimos IPv4 sem desactivar IPv6 globalmente.
   */
  setDefaultResultOrder('ipv4first');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();

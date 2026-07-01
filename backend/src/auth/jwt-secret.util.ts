import { ConfigService } from '@nestjs/config';

/**
 * Lê e valida o secret JWT.
 * Partilhado entre o JwtStrategy (HTTP) e o WorldGateway (WebSocket) para que
 * ambos os caminhos de autenticação nunca possam divergir sobre o secret usado.
 */
export function getJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return secret;
}

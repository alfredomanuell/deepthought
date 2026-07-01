import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldGateway } from './world.gateway';
import { PresenceService } from './presence.service';

/**
 * Módulo do gateway WebSocket em tempo real do mundo do jogo.
 * Reutiliza o JwtModule já exportado pelo AuthModule para validar o token
 * no handshake do socket, em vez de duplicar a configuração do JWT.
 */
@Module({
  imports: [AuthModule, PrismaModule],
  providers: [WorldGateway, PresenceService],
})
export class GatewayModule {}

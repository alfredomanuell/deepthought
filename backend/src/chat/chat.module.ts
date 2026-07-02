import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FriendshipsModule } from '../friendships/friendships.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

/**
 * Módulo de chat: sala global + mensagens directas.
 * REST para arranque/histórico; ChatGateway para eventos em tempo real.
 * A autenticação do socket é herdada do WorldGateway (mesmo servidor).
 */
@Module({
  imports: [PrismaModule, FriendshipsModule, NotificationsModule, RealtimeModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FriendshipsController } from './friendships.controller';
import { FriendshipsService } from './friendships.service';

/**
 * Módulo do sistema de amizades e bloqueios.
 * Exporta o FriendshipsService para a lógica de privacidade noutros módulos
 * (perfil público limitado; futuramente filtragem de mensagens no chat).
 */
@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [FriendshipsController],
  providers: [FriendshipsService],
  exports: [FriendshipsService],
})
export class FriendshipsModule {}

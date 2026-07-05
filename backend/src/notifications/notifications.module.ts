import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';

/**
 * Módulo de notificações.
 * Expõe a API HTTP do utilizador autenticado e exporta o
 * NotificationsService para ser usado por outros módulos:
 * - AchievementsModule
 * - ProjectsModule
 * - FriendshipsModule
 */
@Module({
  imports: [PrismaModule, RealtimeModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

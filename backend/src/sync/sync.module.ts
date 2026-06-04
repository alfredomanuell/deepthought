import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FortyTwoModule } from '../integrations/fortytwo/fortytwo.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Módulo responsável pela sincronização de dados com a API 42.
 * Depende de:
 * - FortyTwoModule: para aceder à API 42
 * - AchievementsModule: para verificar conquistas após sync
 * - NotificationsModule: para criar notificações ao desbloquear conquistas
 */
@Module({
  imports: [
    PrismaModule,
    FortyTwoModule,
    AchievementsModule,
    NotificationsModule,
  ],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
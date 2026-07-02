import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FriendshipsModule } from '../friendships/friendships.module';

/**
 * Módulo do Project Board.
 * Gere o estado de projectos, pedidos/ofertas de ajuda e convites.
 */
@Module({
  imports: [
    PrismaModule,
    AchievementsModule,
    NotificationsModule,
    FriendshipsModule,
  ],
  controllers: [ProjectsController, InvitationsController],
  providers: [ProjectsService, InvitationsService],
})
export class ProjectsModule {}

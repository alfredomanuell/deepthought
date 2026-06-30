import { Module } from '@nestjs/common';

import { AnnouncementsModule } from './announcements/announcements.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AchievementsModule } from './achievements/achievements.module';
import { ProjectsModule } from './projects/projects.module';
import { ResourcesModule } from './resources/resources.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { FeedbackModule } from './feedback/feedback.module';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { FortyTwoModule } from './integrations/fortytwo/fortytwo.module';

@Module({
  imports: [
    ConfigModule.forRoot({ //permite acessar variáveis do .env em qualquer lugar do backend
      isGlobal: true,
    }),

    AnnouncementsModule,
    AuthModule,
    UsersModule,
    AchievementsModule,
    ProjectsModule,
    ResourcesModule,
    LeaderboardModule,
    FeedbackModule,
    AdminModule,
    PrismaModule,
    FortyTwoModule,
  ],
})
export class AppModule {}
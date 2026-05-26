import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AchivementsModule } from './achivements/achivements.module';
import { ProjectsModule } from './projects/projects.module';
import { ResourcesModule } from './resources/resources.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [AuthModule, UsersModule, AchivementsModule, ProjectsModule, ResourcesModule, LeaderboardModule, FeedbackModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AchivementsModule } from './achivements/achivements.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [AuthModule, UsersModule, AchivementsModule, ProjectsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

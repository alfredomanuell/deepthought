import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get('achievements')
  findAll() {
    return this.achievementsService.findAll();
  }

  @Get('users/:id/achievements')
  findByUser(@Param('id') id: string) {
    return this.achievementsService.findByUser(id);
  }
}

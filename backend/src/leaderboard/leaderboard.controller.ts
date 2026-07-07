import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('xp')
  getXpRanking(
    @Query(new ValidationPipe({ transform: true })) query: LeaderboardQueryDto,
    @Req() req: any,
  ) {
    return this.leaderboardService.getXpLeaderboard(query, req.user.sub);
  }

  @Get('achievements')
  getAchievementsRanking(
    @Query(new ValidationPipe({ transform: true })) query: LeaderboardQueryDto,
    @Req() req: any,
  ) {
    return this.leaderboardService.getAchievementsLeaderboard(query, req.user.sub);
  }

  @Get('level')
  getLevelRanking(
    @Query(new ValidationPipe({ transform: true })) query: LeaderboardQueryDto,
    @Req() req: any,
  ) {
    return this.leaderboardService.getLevelLeaderboard(query, req.user.sub);
  }
}

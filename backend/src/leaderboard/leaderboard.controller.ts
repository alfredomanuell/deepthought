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

/**
 * Controlador de leaderboards.
 *
 * Endpoints:
 * GET /leaderboard/xp           → Ranking por XP
 * GET /leaderboard/achievements → Ranking por número de conquistas
 * GET /leaderboard/level        → Ranking por nível
 */
@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(
    /** Serviço com a lógica de cálculo de rankings */
    private readonly leaderboardService: LeaderboardService,
  ) {}

  /**
   * GET /leaderboard/xp
   * Retorna o ranking global por XP (descendente).
   * Inclui a posição do utilizador autenticado no ranking.
   *
   * @example GET /leaderboard/xp?page=1&limit=20
   */
  @Get('xp')
  getXpRanking(
    @Query(new ValidationPipe({ transform: true })) query: LeaderboardQueryDto,
    @Req() req: any,
  ) {
    return this.leaderboardService.getXpLeaderboard(query, req.user.sub);
  }

  /**
   * GET /leaderboard/achievements
   * Retorna o ranking por número de conquistas desbloqueadas.
   *
   * @example GET /leaderboard/achievements?page=1
   */
  @Get('achievements')
  getAchievementsRanking(
    @Query(new ValidationPipe({ transform: true })) query: LeaderboardQueryDto,
    @Req() req: any,
  ) {
    return this.leaderboardService.getAchievementsLeaderboard(query, req.user.sub);
  }

  /**
   * GET /leaderboard/level
   * Retorna o ranking por nível (descendente).
   * XP é usado como critério de desempate.
   *
   * @example GET /leaderboard/level?page=1
   */
  @Get('level')
  getLevelRanking(
    @Query(new ValidationPipe({ transform: true })) query: LeaderboardQueryDto,
    @Req() req: any,
  ) {
    return this.leaderboardService.getLevelLeaderboard(query, req.user.sub);
  }
}
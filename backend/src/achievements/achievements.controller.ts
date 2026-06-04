import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador do módulo de conquistas.
 *
 * Endpoints:
 * GET /achievements          → Lista todas as conquistas disponíveis
 * GET /users/:id/achievements → Conquistas desbloqueadas por utilizador
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(
    /** Serviço de conquistas com a lógica de verificação */
    private readonly achievementsService: AchievementsService,
  ) {}

  /**
   * GET /achievements
   * Retorna o catálogo completo de conquistas disponíveis.
   * Ordenado por xpReward crescente.
   *
   * @example Response:
   * [{ id, slug, title, description, icon, xpReward }]
   */
  @Get('achievements')
  findAll() {
    return this.achievementsService.findAll();
  }

  /**
   * GET /users/:id/achievements
   * Retorna as conquistas desbloqueadas por um utilizador específico.
   * Inclui os detalhes da conquista e a data de desbloqueio.
   *
   * @param id ID interno do utilizador
   *
   * @example Response:
   * [{ id, unlockedAt, achievement: { title, icon, xpReward } }]
   */
  @Get('users/:id/achievements')
  findByUser(@Param('id') id: string) {
    return this.achievementsService.findByUser(id);
  }
}
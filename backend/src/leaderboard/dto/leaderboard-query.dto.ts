import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para query parameters dos endpoints de leaderboard.
 * Suporta paginação e filtros por campus/coligação.
 */
export class LeaderboardQueryDto {
  /**
   * Número da página (começa em 1).
   * @default 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Resultados por página.
   * @default 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
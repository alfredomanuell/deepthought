import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para query parameters de listagem de utilizadores.
 * Suporta filtros por login, campus e coligação, além de paginação.
 *
 * Endpoint: GET /users
 */
export class UsersQueryDto {
  /**
   * Filtrar por login (pesquisa parcial, case-insensitive).
   * @example "jsilva"
   */
  @IsOptional()
  @IsString()
  login?: string;

  /**
   * Filtrar por campus.
   * @example "Lisboa"
   */
  @IsOptional()
  @IsString()
  campus?: string;

  /**
   * Filtrar por coligação.
   * @example "The Alliance"
   */
  @IsOptional()
  @IsString()
  coalition?: string;

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
   * Número de resultados por página.
   * @default 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
import {
  IsEnum,
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

/**
 * DTO para actualizar o estado de um projecto.
 * PATCH /projects/:id
 */
export class UpdateProjectStatusDto {
  /**
   * Novo estado do projecto.
   * Valores permitidos: NOT_STARTED, IN_PROGRESS, FINISHED, FAILED
   */
  @IsEnum(ProjectStatus, {
    message: `status must be one of: ${Object.values(ProjectStatus).join(', ')}`,
  })
  status!: ProjectStatus;

  /**
   * Nota final do projecto (0-100). Opcional.
   * @example 84
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  finalMark?: number;
}

/**
 * DTO para criar um pedido de ajuda num projecto.
 * POST /projects/:id/help-request
 */
export class CreateHelpRequestDto {
  /**
   * Título curto do pedido de ajuda.
   * @example "Erro de segmentation fault no ft_printf"
   */
  @IsString()
  @MinLength(5, { message: 'title must be at least 5 characters' })
  @MaxLength(100, { message: 'title must be at most 100 characters' })
  title!: string;

  /**
   * Descrição detalhada do problema.
   * @example "Estou a ter um segfault na função ft_printf quando uso o specifier %s..."
   */
  @IsString()
  @MinLength(10, { message: 'description must be at least 10 characters' })
  @MaxLength(1000, { message: 'description must be at most 1000 characters' })
  description!: string;
}

/**
 * DTO para oferecer ajuda num projecto.
 * POST /projects/:id/help-offer
 */
export class CreateHelpOfferDto {
  /**
   * Mensagem opcional com contexto da oferta de ajuda.
   * @example "Passei pelo mesmo problema, posso ajudar!"
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

/**
 * DTO para query parameters de listagem de projectos.
 * GET /projects
 */
export class ProjectsQueryDto {
  /**
   * Filtrar por estado do projecto.
   */
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  /**
   * Filtrar apenas projectos que precisam de ajuda.
   * `@Type(() => Boolean)` converteria "false" em true; a transform explícita
   * mapeia as strings da query para booleanos reais.
   */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  needHelp?: boolean;

  /**
   * Filtrar por campus do utilizador dono do projecto.
   */
  @IsOptional()
  @IsString()
  campus?: string;

  /**
   * Apenas os projectos do utilizador autenticado.
   */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  mine?: boolean;

  /** Página (começa em 1) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Resultados por página */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
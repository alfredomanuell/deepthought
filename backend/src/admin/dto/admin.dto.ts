import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';

/**
 * DTO para criar um utilizador manualmente (admin).
 * POST /admin/users
 */
export class CreateUserDto {
  /**
   * ID da 42 do utilizador.
   */
  @IsInt()
  fortyTwoId!: number;

  /**
   * Login único da 42.
   * @example "jsilva"
   */
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  login!: string;

  /**
   * Email do utilizador.
   */
  @IsEmail()
  email!: string;

  /**
   * Nome de exibição.
   */
  @IsString()
  @MaxLength(50)
  displayName!: string;

  /**
   * Campus do utilizador.
   */
  @IsOptional()
  @IsString()
  campus?: string;

  /**
   * Role inicial do utilizador.
   * @default 'USER'
   */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

/**
 * DTO para editar qualquer utilizador (admin).
 * PATCH /admin/users/:id
 */
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  campus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  coalition?: string;

  @IsOptional()
  @IsBoolean()
  isEmailVerified?: boolean;
}

/**
 * DTO para banir um utilizador.
 * PATCH /admin/users/:id/ban
 */
export class BanUserDto {
  /**
   * Motivo do ban (para registo interno).
   * @example "Comportamento inadequado na plataforma"
   */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

/**
 * DTO para alterar o role de um utilizador.
 * PATCH /admin/users/:id/role
 */
export class UpdateRoleDto {
  /**
   * Novo role.
   * Valores: USER, MODERATOR, ADMIN
   */
  @IsEnum(Role, {
    message: `role must be one of: ${Object.values(Role).join(', ')}`,
  })
  role!: Role;
}

/**
 * DTO para query parameters de listagem admin.
 * GET /admin/users
 */
export class AdminUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  campus?: string;

  /** Transform explícita: `@Type(() => Boolean)` converteria "false" em true. */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  banned?: boolean;

  @IsOptional()
  @IsString()
  login?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
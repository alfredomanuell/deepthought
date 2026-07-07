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

export class CreateUserDto {
  @IsInt()
  fortyTwoId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  login!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(50)
  displayName!: string;

  @IsOptional()
  @IsString()
  campus?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

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

export class BanUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateRoleDto {
  @IsEnum(Role, {
    message: `role must be one of: ${Object.values(Role).join(', ')}`,
  })
  role!: Role;
}

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

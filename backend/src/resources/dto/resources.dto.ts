import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ResourceType } from '@prisma/client';
import { Type } from 'class-transformer';

/**
 * DTO para criar um novo recurso partilhado (URL-based).
 * POST /resources
 */
export class CreateResourceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUrl({}, { message: 'url must be a valid URL' })
  url!: string;

  @IsEnum(ResourceType, {
    message: `type must be one of: ${Object.values(ResourceType).join(', ')}`,
  })
  type!: ResourceType;

  @IsString()
  projectId!: string;
}

/**
 * DTO para upload de ficheiro (multipart/form-data).
 * POST /resources/upload
 */
export class UploadResourceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  projectId!: string;
}

/**
 * DTO para query parameters de listagem de recursos.
 * GET /resources
 */
export class ResourcesQueryDto {
  /**
   * Filtrar por projecto (ID do projecto).
   */
  @IsOptional()
  @IsString()
  projectId?: string;

  /**
   * Filtrar por tipo de recurso.
   */
  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

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
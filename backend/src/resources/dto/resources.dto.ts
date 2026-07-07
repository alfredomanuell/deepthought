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

export class ResourcesQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(ResourceType)
  type?: ResourceType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

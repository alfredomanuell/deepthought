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

export class UpdateProjectStatusDto {
  @IsEnum(ProjectStatus, {
    message: `status must be one of: ${Object.values(ProjectStatus).join(', ')}`,
  })
  status!: ProjectStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  finalMark?: number;
}

export class CreateHelpRequestDto {
  @IsString()
  @MinLength(5, { message: 'title must be at least 5 characters' })
  @MaxLength(100, { message: 'title must be at most 100 characters' })
  title!: string;

  @IsString()
  @MinLength(10, { message: 'description must be at least 10 characters' })
  @MaxLength(1000, { message: 'description must be at most 1000 characters' })
  description!: string;
}

export class CreateHelpOfferDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class ProjectsQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  /**
   * `@Type(() => Boolean)` converteria "false" em true; a transform explícita
   * mapeia as strings da query para booleanos reais.
   */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  needHelp?: boolean;

  @IsOptional()
  @IsString()
  campus?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  mine?: boolean;

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

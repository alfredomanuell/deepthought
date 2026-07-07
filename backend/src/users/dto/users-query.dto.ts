import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UsersQueryDto {
  @IsOptional()
  @IsString()
  login?: string;

  @IsOptional()
  @IsString()
  campus?: string;

  @IsOptional()
  @IsString()
  coalition?: string;

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

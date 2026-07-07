import {
  IsString,
  IsOptional,
  MaxLength,
  IsUrl,
  IsObject,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'displayName must be a string' })
  @MaxLength(50, { message: 'displayName must be at most 50 characters' })
  displayName?: string;

  @IsOptional()
  @IsUrl({}, { message: 'avatar must be a valid URL' })
  @MaxLength(500, { message: 'avatar URL must be at most 500 characters' })
  avatar?: string;

  @IsOptional()
  @IsString({ message: 'bio must be a string' })
  @MaxLength(300, { message: 'bio must be at most 300 characters' })
  bio?: string;

  @IsOptional()
  @IsObject({ message: 'characterLayers must be an object' })
  characterLayers?: {
    skin?: string;
    eyes?: string;
    hair?: string;
    clothes?: string;
    accessory?: string;
  };
}

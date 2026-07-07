import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  userId!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must contain exactly 6 digits' })
  code!: string;
}

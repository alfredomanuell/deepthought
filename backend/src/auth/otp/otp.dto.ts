import { IsString, Matches } from 'class-validator';

/** DTO do corpo recebido em POST /auth/otp/verify. */
export class VerifyOtpDto {
  /** ID interno do utilizador criado/encontrado após o OAuth da 42. */
  @IsString()
  userId: string;

  /** OTP deve conter exactamente 6 dígitos, sem letras ou espaços. */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must contain exactly 6 digits' })
  code: string;
}

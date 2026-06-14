import { IsString, MinLength } from 'class-validator';

/** DTO do corpo recebido em POST /auth/refresh. */
export class RefreshTokenDto {
  /** Refresh token emitido pelo fluxo OAuth -> JWT ou OTP -> JWT. */
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

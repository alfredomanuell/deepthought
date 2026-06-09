import { Body, Controller, Post } from '@nestjs/common';
import { VerifyOtpDto } from './otp.dto';
import { OtpService, OtpTokens } from './otp.service';

/** Controller HTTP do fluxo OTP. */
@Controller('auth/otp')
export class OtpController {
  constructor(
    /** Toda a lógica de negócio fica no service, não no controller. */
    private readonly otpService: OtpService,
  ) {}

  /** Endpoint POST /auth/otp/verify para trocar OTP válido por JWTs. */
  @Post('verify')
  async verify(@Body() dto: VerifyOtpDto): Promise<OtpTokens> {
    /** Encaminha o DTO validado para o service executar validação e emissão. */
    return this.otpService.verifyOtp(dto);
  }
}

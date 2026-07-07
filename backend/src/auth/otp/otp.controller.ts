import { Body, Controller, Post } from '@nestjs/common';
import { VerifyOtpDto } from './otp.dto';
import { OtpService, OtpTokens } from './otp.service';

@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('verify')
  async verify(@Body() dto: VerifyOtpDto): Promise<OtpTokens> {
    return this.otpService.verifyOtp(dto);
  }
}

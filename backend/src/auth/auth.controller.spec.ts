import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp/otp.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          /** Mock mínimo porque este spec só verifica se o controller compila. */
          provide: AuthService,
          /** O método existe para satisfazer a injecção sem executar OAuth real. */
          useValue: { login42: jest.fn() },
        },
        {
          /** Mock do serviço OTP/JWT reutilizado pelo endpoint POST /auth/refresh. */
          provide: OtpService,
          /** Evita assinar JWT real no teste estrutural do controller. */
          useValue: { refreshTokens: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

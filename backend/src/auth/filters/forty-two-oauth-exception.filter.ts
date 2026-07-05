import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Trata falhas do Passport OAuth2 antes de chegarem ao AuthController callback.
 *
 * Quando a troca do code por access token da 42 falha por timeout/rede, o guard
 * lança InternalOAuthError. Em vez de expor 500 cru ao browser, redireccionamos
 * para /login com um erro curto para o frontend poder mostrar feedback.
 */
@Catch()
export class FortyTwoOAuthExceptionFilter implements ExceptionFilter {
  /** Logger dedicado às falhas externas da 42 OAuth. */
  private readonly logger = new Logger(FortyTwoOAuthExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    /** O filtro é usado apenas nas rotas OAuth, por isso a resposta é sempre redirect. */
    const response = host.switchToHttp().getResponse<Response>();
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const message =
      exception instanceof Error ? exception.message : String(exception);

    if (exception instanceof ForbiddenException && exception.message === 'not_eligible') {
      return response.redirect(`${frontendUrl}/?oauthError=not_eligible`);
    }

    /**
     * O detalhe técnico fica no log; o browser recebe só um código estável.
     * Isto cobre ETIMEDOUT/ENETUNREACH sem revelar stack trace ao utilizador.
     */
    this.logger.error(`42 OAuth failed: ${message}`);

    return response.redirect(`${frontendUrl}/?oauthError=42_unavailable`);
  }
}

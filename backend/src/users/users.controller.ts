import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador do módulo de utilizadores.
 * Todos os endpoints requerem autenticação via JWT.
 *
 * Endpoints:
 * GET  /users        → Lista utilizadores com filtros e paginação
 * GET  /users/me     → Perfil completo do utilizador autenticado
 * PATCH /users/me    → Actualiza perfil próprio
 * GET  /users/:id    → Perfil público de outro utilizador
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    /** Serviço com a lógica de negócio de utilizadores */
    private readonly usersService: UsersService,
  ) {}

  /**
   * GET /users
   * Lista utilizadores com suporte a filtros e paginação.
   * Utilizadores banidos são excluídos automaticamente.
   *
   * @example GET /users?campus=Lisboa&page=1&limit=20
   * @example GET /users?login=jsilva
   */
  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true })) query: UsersQueryDto,
  ) {
    return this.usersService.findAll(query);
  }

  /**
   * GET /users/me
   * Retorna o perfil completo do utilizador autenticado.
   * Inclui: conquistas, projectos, estatísticas e notificações não lidas.
   *
   * NOTA: Esta rota deve vir ANTES de GET /users/:id para o NestJS
   * não interpretar 'me' como um ID.
   */
  @Get('me')
  findMe(@Req() req: any) {
    // req.user é preenchido pelo JwtStrategy após validação do token
    return this.usersService.findMe(req.user.sub);
  }

  /**
   * PATCH /users/me
   * Actualiza o perfil do utilizador autenticado.
   * Campos permitidos: displayName, avatar, bio.
   *
   * @example
   * PATCH /users/me
   * { "bio": "42 Lisboa student" }
   */
  @Patch('me')
  updateMe(
    @Req() req: any,
    @Body(new ValidationPipe()) dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(req.user.sub, dto);
  }

  /**
   * GET /users/:id
   * Retorna o perfil público de um utilizador por ID interno.
   * Não expõe dados sensíveis.
   *
   * @param id ID interno (cuid) do utilizador
   */
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    // O viewer é necessário para aplicar a privacidade de bloqueios
    return this.usersService.findPublicProfile(id, req.user.sub);
  }
}
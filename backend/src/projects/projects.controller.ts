import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import {
  UpdateProjectStatusDto,
  CreateHelpRequestDto,
  CreateHelpOfferDto,
  ProjectsQueryDto,
} from './dto/projects.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador do Project Board.
 *
 * Endpoints:
 * GET    /projects                   → Lista projectos de todos os utilizadores
 * GET    /projects/help/open         → Lista pedidos de ajuda abertos
 * GET    /projects/:id               → Detalhe de um projecto
 * PATCH  /projects/:id               → Actualiza estado (apenas o dono)
 * POST   /projects/:id/help-request  → Criar pedido de ajuda
 * POST   /projects/:id/help-offer    → Oferecer ajuda
 */
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    /** Serviço com a lógica de negócio de projectos */
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * GET /projects
   * Lista todos os userProjects com filtros opcionais.
   * @example GET /projects?status=IN_PROGRESS&needHelp=true
   */
  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true })) query: ProjectsQueryDto,
    @Req() req: any,
  ) {
    return this.projectsService.findAll(query, req.user.sub);
  }

  /**
   * GET /projects/catalog
   * Retorna todos os projectos disponíveis na plataforma (id, name, slug).
   * NOTA: deve vir antes de GET /projects/:id para evitar conflito de rota.
   */
  @Get('catalog')
  findCatalog() {
    return this.projectsService.findCatalog();
  }

  /**
   * GET /projects/help/open
   * Lista pedidos de ajuda não resolvidos.
   * NOTA: deve vir antes de GET /projects/:id para evitar conflito de rota.
   */
  @Get('help/open')
  findOpenHelpRequests(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.projectsService.findOpenHelpRequests(page, limit);
  }

  /**
   * GET /projects/:id/offers
   * Ofertas de ajuda recebidas num projecto próprio (:id = UserProject.id).
   */
  @Get(':id/offers')
  listOffers(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.listOffers(id, req.user.sub);
  }

  /**
   * POST /projects/offers/:offerId/accept
   * Aceita uma oferta de ajuda: amizade automática + fecha o pedido.
   */
  @Post('offers/:offerId/accept')
  @HttpCode(HttpStatus.OK)
  acceptOffer(@Param('offerId') offerId: string, @Req() req: any) {
    return this.projectsService.acceptOffer(offerId, {
      sub: req.user.sub,
      login: req.user.login,
    });
  }

  /**
   * GET /projects/:id/peers
   * Quem está a fazer / terminou / é elegível para um Project do catálogo.
   */
  @Get(':id/peers')
  findPeers(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.findPeers(id, req.user.sub);
  }

  /**
   * GET /projects/:id
   * Retorna os detalhes completos de um Project.
   * O parâmetro `id` é Project.id; PATCH/help continuam a usar UserProject.id.
   * Inclui: users, resources e chatRooms.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  /**
   * PATCH /projects/:id
   * Actualiza o estado do projecto (apenas o dono).
   * Dispara verificação de conquistas ao marcar como FINISHED.
   */
  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body(new ValidationPipe()) dto: UpdateProjectStatusDto,
  ) {
    return this.projectsService.updateStatus(id, req.user.sub, dto);
  }

  /**
   * POST /projects/:id/help-request
   * Cria um pedido de ajuda para o projecto.
   * Activa a flag needHelp automaticamente.
   */
  @Post(':id/help-request')
  @HttpCode(HttpStatus.CREATED)
  createHelpRequest(
    @Param('id') id: string,
    @Req() req: any,
    @Body(new ValidationPipe()) dto: CreateHelpRequestDto,
  ) {
    return this.projectsService.createHelpRequest(id, req.user.sub, dto);
  }

  /**
   * POST /projects/:id/help-offer
   * Oferece ajuda num projecto de outro utilizador.
   * Notifica o dono do projecto e verifica conquistas do helper.
   */
  @Post(':id/help-offer')
  @HttpCode(HttpStatus.CREATED)
  createHelpOffer(
    @Param('id') id: string,
    @Req() req: any,
    @Body(new ValidationPipe()) dto: CreateHelpOfferDto,
  ) {
    return this.projectsService.createHelpOffer(id, req.user.sub, dto);
  }
}

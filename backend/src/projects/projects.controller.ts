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

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true })) query: ProjectsQueryDto,
    @Req() req: any,
  ) {
    return this.projectsService.findAll(query, req.user.sub);
  }

  /** Deve vir antes de GET /projects/:id para evitar conflito de rota. */
  @Get('catalog')
  findCatalog() {
    return this.projectsService.findCatalog();
  }

  /** Deve vir antes de GET /projects/:id para evitar conflito de rota. */
  @Get('help/open')
  findOpenHelpRequests(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.projectsService.findOpenHelpRequests(page, limit);
  }

  @Get(':id/offers')
  listOffers(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.listOffers(id, req.user.sub);
  }

  @Post('offers/:offerId/accept')
  @HttpCode(HttpStatus.OK)
  acceptOffer(@Param('offerId') offerId: string, @Req() req: any) {
    return this.projectsService.acceptOffer(offerId, {
      sub: req.user.sub,
      login: req.user.login,
    });
  }

  @Get(':id/peers')
  findPeers(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.findPeers(id, req.user.sub);
  }

  /**
   * O parâmetro `id` é Project.id; PATCH/help continuam a usar UserProject.id.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body(new ValidationPipe()) dto: UpdateProjectStatusDto,
  ) {
    return this.projectsService.updateStatus(id, req.user.sub, dto);
  }

  @Post(':id/help-request')
  @HttpCode(HttpStatus.CREATED)
  createHelpRequest(
    @Param('id') id: string,
    @Req() req: any,
    @Body(new ValidationPipe()) dto: CreateHelpRequestDto,
  ) {
    return this.projectsService.createHelpRequest(id, req.user.sub, dto);
  }

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

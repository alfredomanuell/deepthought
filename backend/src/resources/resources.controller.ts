import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResourcesService } from './resources.service';
import { FileUploadService, FILE_UPLOAD_CONFIG } from './file-upload.service';
import { CreateResourceDto, UploadResourceDto, ResourcesQueryDto } from './dto/resources.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Controlador de recursos partilhados.
 *
 * Endpoints:
 * GET    /resources                  → Lista recursos (filtros: projectId, type)
 * POST   /resources                  → Criar novo recurso
 * DELETE /resources/:id              → Apagar recurso (dono ou admin)
 * GET    /projects/:id/resources     → Recursos de um projecto específico
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class ResourcesController {
  constructor(
    private readonly resourcesService: ResourcesService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  /**
   * GET /resources
   * Lista todos os recursos com filtros opcionais.
   * @example GET /resources?projectId=clx1...&type=GITHUB
   */
  @Get('resources')
  findAll(
    @Query(new ValidationPipe({ transform: true })) query: ResourcesQueryDto,
  ) {
    return this.resourcesService.findAll(query);
  }

  /**
   * POST /resources
   * Cria um novo recurso partilhado.
   * O userId é extraído do token JWT.
   */
  @Post('resources')
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: any, @Body(new ValidationPipe()) dto: CreateResourceDto) {
    return this.resourcesService.create(req.user.sub, dto);
  }

  /**
   * POST /resources/upload
   * Faz upload de um ficheiro como recurso partilhado.
   * Recebe multipart/form-data com file, title, description?, projectId.
   */
  @Post('resources/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file', FILE_UPLOAD_CONFIG))
  upload(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ValidationPipe({ transform: true })) dto: UploadResourceDto,
  ) {
    return this.resourcesService.createFromFile(req.user.sub, dto, file);
  }

  /**
   * DELETE /resources/:id
   * Apaga um recurso. Apenas o criador ou um ADMIN pode apagar.
   */
  @Delete('resources/:id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.resourcesService.remove(id, req.user.sub, req.user.role);
  }

  /**
   * GET /projects/:id/resources
   * Lista os recursos associados a um projecto específico.
   */
  @Get('projects/:id/resources')
  findByProject(
    @Param('id') projectId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.resourcesService.findByProject(projectId, page, limit);
  }
}
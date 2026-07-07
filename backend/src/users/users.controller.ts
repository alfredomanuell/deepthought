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

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(
    @Query(new ValidationPipe({ transform: true })) query: UsersQueryDto,
  ) {
    return this.usersService.findAll(query);
  }

  /**
   * NOTA: Esta rota deve vir ANTES de GET /users/:id para o NestJS
   * não interpretar 'me' como um ID.
   */
  @Get('me')
  findMe(@Req() req: any) {
    return this.usersService.findMe(req.user.sub);
  }

  @Patch('me')
  updateMe(
    @Req() req: any,
    @Body(new ValidationPipe()) dto: UpdateProfileDto,
  ) {
    return this.usersService.updateMe(req.user.sub, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.usersService.findPublicProfile(id, req.user.sub);
  }
}

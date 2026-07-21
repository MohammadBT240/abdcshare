import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './presentation/dto/create-client.dto';
import { UpdateClientDto } from './presentation/dto/update-client.dto';
import { ClientListQueryDto } from './presentation/dto/client-list-query.dto';
import { ClientListResponseDto, ClientResponseDto } from './presentation/dto/client-response.dto';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Post()
  @RequirePermission('client:manage')
  create(@Body() dto: CreateClientDto): Promise<ClientResponseDto> {
    return this.clients.create(dto);
  }

  @Get()
  @RequirePermission('client:view')
  list(@Query() query: ClientListQueryDto): Promise<ClientListResponseDto> {
    return this.clients.list(query);
  }

  @Get(':id')
  @RequirePermission('client:view')
  getOne(@Param('id') id: string): Promise<ClientResponseDto> {
    return this.clients.getOne(id);
  }

  @Patch(':id')
  @RequirePermission('client:manage')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto): Promise<ClientResponseDto> {
    return this.clients.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('client:manage')
  deactivate(@Param('id') id: string): Promise<ClientResponseDto> {
    return this.clients.deactivate(id);
  }
}

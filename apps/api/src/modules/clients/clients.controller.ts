import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './presentation/dto/create-client.dto';
import { UpdateClientDto } from './presentation/dto/update-client.dto';
import { ClientListQueryDto } from './presentation/dto/client-list-query.dto';
import {
  CreateClientContactDto,
  UpdateClientContactDto,
  ClientContactResponseDto,
} from './presentation/dto/client-contact.dto';
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

  @Get(':id/contacts')
  @RequirePermission('client:view')
  listContacts(@Param('id') id: string): Promise<ClientContactResponseDto[]> {
    return this.clients.listContacts(id);
  }

  @Post(':id/contacts')
  @RequirePermission('client:manage')
  addContact(
    @Param('id') id: string,
    @Body() dto: CreateClientContactDto,
  ): Promise<ClientContactResponseDto> {
    return this.clients.addContact(id, dto);
  }

  @Patch(':id/contacts/:userId')
  @RequirePermission('client:manage')
  updateContact(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateClientContactDto,
  ): Promise<ClientContactResponseDto> {
    return this.clients.updateContact(id, userId, dto);
  }

  @Post(':id/contacts/:userId/set-primary')
  @RequirePermission('client:manage')
  setPrimary(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<ClientContactResponseDto> {
    return this.clients.setPrimaryContact(id, userId);
  }

  @Post(':id/contacts/:userId/reset-password')
  @RequirePermission('client:manage')
  resetContactUserPassword(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<ClientContactResponseDto> {
    return this.clients.resetContactUserPassword(id, userId);
  }

  @Post(':id/contacts/:userId/deactivate')
  @RequirePermission('client:manage')
  deactivateContact(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<ClientContactResponseDto> {
    return this.clients.deactivateContact(id, userId);
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

  /** Reset primary contact credentials and email a new temporary password. */
  @Post(':id/reset-contact-password')
  @RequirePermission('client:manage')
  resetContactPassword(@Param('id') id: string): Promise<ClientResponseDto> {
    return this.clients.resetContactPassword(id);
  }
}

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ReferenceService } from './reference.service';
import { CreateLookupDto, LookupListQueryDto, UpdateLookupDto } from './presentation/dto/lookup.dto';
import { LOOKUP_TYPES } from './reference.registry';

@ApiTags('reference')
@ApiBearerAuth()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly reference: ReferenceService) {}

  /** List the available lookup types (titles, genders, states, lgas, wards, ...). */
  @Get()
  types(): string[] {
    return LOOKUP_TYPES;
  }

  /** Read-only lookup lists — any authenticated user (needed for self-service profile). */
  @Get(':type')
  list(@Param('type') type: string, @Query() query: LookupListQueryDto) {
    return this.reference.list(type, query);
  }

  @Post(':type')
  @RequirePermission('reference-data:manage')
  create(@Param('type') type: string, @Body() dto: CreateLookupDto) {
    return this.reference.create(type, dto);
  }

  @Patch(':type/:id')
  @RequirePermission('reference-data:manage')
  update(
    @Param('type') type: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLookupDto,
  ) {
    return this.reference.update(type, id, dto);
  }
}

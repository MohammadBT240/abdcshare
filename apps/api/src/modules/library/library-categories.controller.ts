import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { hasPermission, type Paginated } from '@abdcshare/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { LibraryCategoriesService } from './library-categories.service';
import {
  CreateLibraryCategoryDto,
  LibraryCategoryListQueryDto,
  LibraryCategoryResponseDto,
  UpdateLibraryCategoryDto,
} from './presentation/dto/library.dto';

@ApiTags('library')
@ApiBearerAuth()
@Controller('library/categories')
export class LibraryCategoriesController {
  constructor(private readonly categories: LibraryCategoriesService) {}

  @Get()
  @RequirePermission('library:view')
  list(
    @Query() query: LibraryCategoryListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Paginated<LibraryCategoryResponseDto>> {
    const canManage = hasPermission(user.role, 'catalogue:manage', user.partnerDesignation);
    return this.categories.list(query, canManage);
  }

  @Post()
  @RequirePermission('catalogue:manage')
  create(@Body() dto: CreateLibraryCategoryDto): Promise<LibraryCategoryResponseDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermission('catalogue:manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryCategoryDto,
  ): Promise<LibraryCategoryResponseDto> {
    return this.categories.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('catalogue:manage')
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<LibraryCategoryResponseDto> {
    return this.categories.setActive(id, false);
  }

  @Post(':id/activate')
  @RequirePermission('catalogue:manage')
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<LibraryCategoryResponseDto> {
    return this.categories.setActive(id, true);
  }
}

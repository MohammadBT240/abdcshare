import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DepartmentsService } from './departments.service';
import {
  CreateDepartmentDto,
  DepartmentListQueryDto,
  DepartmentListResponseDto,
  DepartmentResponseDto,
  UpdateDepartmentDto,
} from './presentation/dto/department.dto';

@ApiTags('departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Post()
  @RequirePermission('department:manage')
  create(@Body() dto: CreateDepartmentDto): Promise<DepartmentResponseDto> {
    return this.departments.create(dto);
  }

  @Get()
  @RequirePermission('catalogue:view')
  list(@Query() query: DepartmentListQueryDto): Promise<DepartmentListResponseDto> {
    return this.departments.list(query);
  }

  @Get(':id')
  @RequirePermission('catalogue:view')
  getOne(@Param('id', ParseIntPipe) id: number): Promise<DepartmentResponseDto> {
    return this.departments.getOne(id);
  }

  @Patch(':id')
  @RequirePermission('department:manage')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentResponseDto> {
    return this.departments.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('department:manage')
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<DepartmentResponseDto> {
    return this.departments.deactivate(id);
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { StaffService } from './staff.service';

// Query "limit" params arrive as strings; clamp into a sane public range.
function clampLimit(raw: string | undefined, fallback: number): number {
  const parsed = raw ? parseInt(raw, 10) : fallback;
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : fallback;
}

@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly staffService: StaffService) {}

  @Public()
  @Get('top')
  @ApiOperation({
    summary:
      'Top professionals across all salons, ranked by number of appointments',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  findTop(@Query('limit') limit?: string) {
    return this.staffService.findTopProfessionals(clampLimit(limit, 10));
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search professionals by name or specialty' })
  @ApiQuery({ name: 'search', required: false, example: 'ana' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  search(@Query('search') search?: string, @Query('limit') limit?: string) {
    return this.staffService.searchProfessionals(search, clampLimit(limit, 20));
  }

  // Keep the param route LAST so it never shadows the static routes above.
  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Public professional profile with services and reviews',
  })
  findOne(@Param('id') id: string) {
    return this.staffService.findProfessionalProfile(id);
  }
}

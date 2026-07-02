import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SalonsService } from './salons.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly salonsService: SalonsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all service categories (public)' })
  @ApiOkResponse()
  findAll() {
    return this.salonsService.findAllCategories();
  }
}

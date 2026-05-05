import { Body, Controller, Get, Param, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService, CreateReviewDto } from './reviews.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('reviews')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review for a completed appointment' })
  create(@CurrentUser('id') clientId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(clientId, dto);
  }

  @Get('salons/:id/reviews')
  @Public()
  @ApiOperation({ summary: 'Get reviews for a salon' })
  findBySalon(@Param('id') salonId: string) {
    return this.reviewsService.findBySalon(salonId);
  }
}

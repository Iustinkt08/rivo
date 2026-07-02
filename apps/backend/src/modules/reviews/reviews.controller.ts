import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService, CreateReviewDto } from './reviews.service';
import { ReplyReviewDto } from './dto/reply-review.dto';
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
  @ApiOperation({ summary: 'Get published reviews for a salon' })
  findBySalon(@Param('id') salonId: string) {
    return this.reviewsService.findBySalon(salonId);
  }

  @Get('salons/:id/reviews/manage')
  @ApiOperation({ summary: "Owner: list all of the salon's reviews to manage" })
  findBySalonForOwner(
    @Param('id') salonId: string,
    @CurrentUser('id') ownerId: string,
  ) {
    return this.reviewsService.findBySalonForOwner(salonId, ownerId);
  }

  @Patch('reviews/:id/reply')
  @ApiOperation({ summary: 'Owner: reply to a review' })
  reply(
    @Param('id') id: string,
    @CurrentUser('id') ownerId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.reviewsService.reply(id, ownerId, dto.replyText);
  }
}

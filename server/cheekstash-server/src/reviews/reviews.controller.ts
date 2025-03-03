import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HttpCode } from '@nestjs/common';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Create a new review (Protected: Requires authentication)
   */
  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth() // Adds "Authorize" button in Swagger
  @ApiOperation({ summary: 'Submit a review for a collection' })
  async createReview(@Body() createReviewDto: CreateReviewDto, @Req() req) {
    return this.reviewsService.createReview(createReviewDto, req.user.id, req.user.username);
  }

  /**
   * Get all reviews for a collection
   */
  @Get(':collectionId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all reviews for a specific collection' })
  async getReviews(@Param('collectionId') collectionId: string) {
    return this.reviewsService.getReviewsForCollection(collectionId);
  }

  /**
   * Update a review (Protected: Only the review owner)
   */
  @Put(':reviewId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing review (only by owner)' })
  async updateReview(
    @Param('reviewId') reviewId: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @Req() req
  ) {
    return this.reviewsService.updateReview(reviewId, updateReviewDto, req.user.id);
  }

  /**
   * Delete a review (Protected: Only the review owner)
   */
  @Delete(':reviewId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review (only by owner)' })
  async deleteReview(@Param('reviewId') reviewId: string, @Req() req) {
    return this.reviewsService.deleteReview(reviewId, req.user.id);
  }
}

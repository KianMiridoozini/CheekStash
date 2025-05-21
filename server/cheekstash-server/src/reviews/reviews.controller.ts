import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CheekVisibilityGuard } from '../common/guards/cheek-visibility.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
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
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a review for a cheek' })
  async createReview(@Body() createReviewDto: CreateReviewDto, @Req() req) {
    return this.reviewsService.createReview(createReviewDto, req.user.id, req.user.username);
  }

  /**
   * Get all reviews for a cheek
   */
  @Get(':cheekId')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'List of reviews for the cheek' })
  @ApiOperation({ summary: 'Get all reviews for a specific cheek' })
  @UseGuards(OptionalJwtAuthGuard, CheekVisibilityGuard)
  @ApiBearerAuth()
  async getReviews(@Param('cheekId') cheekId: string, @Req() req) {
    const requestingUserId = req.user ? req.user.id : undefined;
    return this.reviewsService.getReviewsForCheek(cheekId, 1, 10, 'createdAt', 'desc', undefined, requestingUserId);
  }

  /**
   * Get all reviews for a cheek by username and slug
   */
  @Get('by-slug/:username/:cheekSlug')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'List of reviews for the cheek, by slug' })
  @ApiOperation({ summary: 'Get all reviews for a specific cheek by username and slug' })
  @UseGuards(OptionalJwtAuthGuard, CheekVisibilityGuard)
  @ApiBearerAuth()
  async getReviewsBySlug(
    @Param('username') username: string,
    @Param('cheekSlug') cheekSlug: string,
    @Req() req,
  ) {
    const requestingUserId = req.user ? req.user.id : undefined;
    return this.reviewsService.getReviewsForCheekBySlug(
      username,
      cheekSlug,
      1,
      10,
      'createdAt',
      'desc',
      undefined,
      requestingUserId,
    );
  }

  /**
   * Get a single review by its ID
   */
  @Get('review/:reviewId')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'The review object' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @ApiOperation({ summary: 'Get a single review by its ID' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getReviewById(@Param('reviewId') reviewId: string, @Req() req) {
    const requestingUserId = req.user ? req.user.id : undefined;
    return this.reviewsService.getReviewById(reviewId, requestingUserId);
  }

  /**
   * Update a review (Protected: Only the review owner)
   */
  @Put(':reviewId')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
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
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review (only by owner)' })
  async deleteReview(@Param('reviewId') reviewId: string, @Req() req) {
    return this.reviewsService.deleteReview(reviewId, req.user.id);
  }
}

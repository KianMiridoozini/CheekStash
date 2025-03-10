import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(@InjectModel(Review.name) private reviewModel: Model<ReviewDocument>) {}

  /**
   * Create a new review
   */
  async createReview(
    createReviewDto: CreateReviewDto,
    userId: string,
    username: string
  ): Promise<Review> {
    try {
      const newReview = new this.reviewModel({
        ...createReviewDto,
        userId,
        username,
      });
      return await newReview.save();
    } catch (error) {
      // Log the error if needed, then rethrow a generic internal server error.
      throw new InternalServerErrorException(
        'Failed to create review: ' + (error.message || 'Unknown error')
      );
    }
  }

  /**
   * Get all reviews for a collection
   */
  async getReviewsForCollection(collectionId: string): Promise<Review[]> {
    return this.reviewModel.find({ collectionId }).exec();
  }

  /**
   * Update an existing review (only by the review owner)
   */
  async updateReview(reviewId: string, updateReviewDto: UpdateReviewDto, userId: string): Promise<Review> {
    const review = await this.reviewModel.findById(reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    Object.assign(review, updateReviewDto);
    return review.save();
  }

  /**
   * Delete a review (only by the review owner)
   */
  async deleteReview(reviewId: string, userId: string): Promise<{ message: string }> {
    const review = await this.reviewModel.findById(reviewId);

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await review.deleteOne();
    return { message: 'Review deleted successfully' };
  }
}

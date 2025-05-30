import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CheeksService } from '../cheeks/cheeks.service';
import { UsersService } from '../users/users.service';
import { CheeksDocument } from '../cheeks/schemas/cheek.schema';
import { TransformedReviewDto, UserResponseDto } from './dto/transformed-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private readonly cheeksService: CheeksService,
    private readonly usersService: UsersService,
  ) { }

  private _validateObjectId(id: string, entityName: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid ${entityName} ID format: \"${id}\".`);
    }
  }

  private async _validateCheekForReviewCreation(cheekId: string, userId: string): Promise<CheeksDocument> {
    this._validateObjectId(cheekId, 'Cheek');
    let cheek: CheeksDocument;
    try {
      cheek = await this.cheeksService.getCheeksById(cheekId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(`Cheek with ID "${cheekId}" not found for review creation.`);
      }
      throw error;
    }

    // DEBUG LOG: Print types and values before comparison
    // console.warn('[DEBUG] cheek.owner:', cheek.owner, 'typeof:', typeof cheek.owner, 'userId:', userId, 'typeof:', typeof userId);

    // Robustly extract owner id as string
    let ownerIdString: string | undefined;
    if (cheek.owner && typeof cheek.owner === 'object' && '_id' in cheek.owner && cheek.owner._id) {
      ownerIdString = cheek.owner._id.toString();
    } else if (typeof cheek.owner === 'string' && Types.ObjectId.isValid(cheek.owner)) {
      ownerIdString = cheek.owner;
    } else if (cheek.owner && typeof cheek.owner === 'object' && typeof cheek.owner.toString === 'function') {
      ownerIdString = cheek.owner.toString();
    }

    if (ownerIdString === userId) {
      throw new ForbiddenException('You cannot review your own cheek.');
    }
    return cheek;
  }

  private async _ensureUserHasNotReviewedCheek(cheekId: string, userId: string): Promise<void> {
    const existingReview = await this.reviewModel.findOne({
      cheekId: new Types.ObjectId(cheekId),
      userId: new Types.ObjectId(userId),
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this cheek.');
    }
  }

  /**
   * Create a new review
   */
  async createReview(
    createReviewDto: CreateReviewDto,
    userId: string,
    username: string,
  ): Promise<TransformedReviewDto> {
    await this._validateCheekForReviewCreation(createReviewDto.cheekId, userId);
    await this._ensureUserHasNotReviewedCheek(createReviewDto.cheekId, userId);

    try {
      const newReview = new this.reviewModel({
        ...createReviewDto,
        cheekId: new Types.ObjectId(createReviewDto.cheekId),
        userId: new Types.ObjectId(userId),
        username, // Storing denormalized username
      });
      const savedReviewDoc = await newReview.save();
      await this.cheeksService.recalculateAndUpdateCheekStats(createReviewDto.cheekId);

      const populatedReview = await this.reviewModel
        .findById(savedReviewDoc._id)
        .populate<{ userId: { _id: Types.ObjectId, username: string, profileImageUrl?: string } }>({
          path: 'userId',
          select: '_id username profileImageUrl',
        })
        .lean()
        .exec();

      if (!populatedReview) {
        throw new InternalServerErrorException('Failed to retrieve and populate review after creation.');
      }

      return this._transformReview(populatedReview);
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('You have already submitted a review for this cheek (database constraint).');
      }
      throw new InternalServerErrorException(
        'Failed to create review: ' + (error.message || 'Unknown error'),
      );
    }
  }

  private _transformReview(review: any): TransformedReviewDto {
    const currentReview = review as unknown as (Review & { _id: Types.ObjectId, userId: { _id: Types.ObjectId, username: string } | Types.ObjectId, createdAt: Date, updatedAt: Date });

    let userResponseObject: UserResponseDto;

    if (currentReview.userId && typeof currentReview.userId === 'object' && '_id' in currentReview.userId && 'username' in currentReview.userId) {
      userResponseObject = {
        _id: (currentReview.userId._id as Types.ObjectId).toString(),
        username: currentReview.userId.username,
      };
    } else if (currentReview.userId instanceof Types.ObjectId) {
      userResponseObject = {
        _id: currentReview.userId.toString(),
        username: currentReview.username || '[user deleted or not found]',
      };
    } else {
      const originalUserIdString = currentReview.userId ? new Types.ObjectId(currentReview.userId as any).toString() : 'unknown_user';
      userResponseObject = {
        _id: originalUserIdString,
        username: currentReview.username || '[unknown user]',
      };
    }

    return {
      _id: currentReview._id.toString(),
      cheekId: currentReview.cheekId.toString(),
      rating: currentReview.rating,
      review: currentReview.review,
      createdAt: currentReview.createdAt.toISOString(),
      updatedAt: currentReview.updatedAt ? currentReview.updatedAt.toISOString() : undefined,
      user: userResponseObject,
    };
  }

  private async _ensureCheekIsViewable(cheekId: string, requestingUserId?: string): Promise<void> {
    // console.log(`[ReviewsService] _ensureCheekIsViewable CALLED for cheekId: ${cheekId}, requestingUserId: ${requestingUserId}`);

    const cheekInfo = await this.cheeksService.findCheekOwnerAndVisibility(cheekId);

    if (!cheekInfo) {
      console.error(`[ReviewsService] Cheek NOT FOUND in _ensureCheekIsViewable for cheekId: ${cheekId}`);
      throw new NotFoundException(`Cheek with ID \\"${cheekId}\\" not found.`);
    }
    // console.log('[ReviewsService] RAW cheekInfo received:', JSON.stringify(cheekInfo, null, 2));

    let ownerIdString: string | undefined = undefined;

    if (cheekInfo.owner) {
      // Case 1: owner is an object like { _id: Types.ObjectId | string } (populated)
      if (typeof cheekInfo.owner === 'object' && '_id' in cheekInfo.owner && cheekInfo.owner._id) {
        if (cheekInfo.owner._id instanceof Types.ObjectId) {
          ownerIdString = cheekInfo.owner._id.toString();
        } else if (typeof cheekInfo.owner._id === 'string' && Types.ObjectId.isValid(cheekInfo.owner._id)) {
          ownerIdString = cheekInfo.owner._id;
        } else {
          console.warn(`[ReviewsService] cheekInfo.owner._id is present but not a valid ObjectId or string:`, cheekInfo.owner._id);
        }
      } else if (cheekInfo.owner instanceof Types.ObjectId) { // Case 2: owner is a direct Types.ObjectId
        ownerIdString = cheekInfo.owner.toString();
      } else if (typeof cheekInfo.owner === 'string' && Types.ObjectId.isValid(cheekInfo.owner)) { // Case 3: owner is a string representing an ObjectId
        ownerIdString = cheekInfo.owner;
      } else {
        console.warn(`[ReviewsService] Unhandled cheekInfo.owner structure:`, cheekInfo.owner);
      }
    }

    // console.log(`[ReviewsService] Determined ownerIdString: ${ownerIdString}, Cheek isPublic: ${cheekInfo.isPublic}`);

    if (!cheekInfo.isPublic) { // Cheek is private
      if (!requestingUserId) {
        console.error(`[ReviewsService] Visibility Check FAIL (Private Cheek, No Requesting User): isPublic=${cheekInfo.isPublic}, requestingUserId=${requestingUserId}`);
        throw new ForbiddenException('You do not have permission to view reviews for this private cheek (not logged in).');
      }
      if (ownerIdString !== requestingUserId) {
        console.error(`[ReviewsService] Visibility Check FAIL (Private Cheek, Mismatch): isPublic=${cheekInfo.isPublic}, requestingUserId=${requestingUserId}, ownerIdString=${ownerIdString}, match: ${ownerIdString === requestingUserId}`);
        throw new ForbiddenException('You do not have permission to view reviews for this private cheek (not owner).');
      }
    }
    // If cheek is public, or if it's private and the requestingUser is the owner, the check passes.
    // console.log(`[ReviewsService] Visibility Check PASS for cheekId: ${cheekId}`);
  }

  /**
   * Get all reviews for a cheek
   */
  async getReviewsForCheek(
    cheekId: string,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    starRating?: number,
    requestingUserId?: string,
  ): Promise<{ reviews: TransformedReviewDto[]; total: number; averageRating: number; ratingCounts: any[] }> {
    if (!Types.ObjectId.isValid(cheekId)) {
      throw new BadRequestException('Invalid Cheek ID format');
    }

    // Centralized cheek visibility check
    await this._ensureCheekIsViewable(cheekId, requestingUserId);

    const cheekObjectId = new Types.ObjectId(cheekId);
    const reviewsFromDb = await this.reviewModel
      .find({ cheekId: cheekObjectId })
      .populate<{ userId: { _id: Types.ObjectId, username: string } | Types.ObjectId }>('userId', '_id username')
      .lean()
      .exec();

    return {
      reviews: reviewsFromDb.map(review => this._transformReview(review)),
      total: reviewsFromDb.length,
      averageRating: reviewsFromDb.reduce((sum, review) => sum + review.rating, 0) / reviewsFromDb.length || 0,
      ratingCounts: Object.entries(
        reviewsFromDb.reduce((counts, review) => {
          counts[review.rating] = (counts[review.rating] || 0) + 1;
          return counts;
        }, {} as Record<number, number>)
      ).map(([rating, count]) => ({ rating: Number(rating), count })),
    };
  }

  async getReviewsForCheekBySlug(
    username: string,
    cheekSlug: string,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    starRating?: number,
    requestingUserId?: string,
  ): Promise<{ reviews: TransformedReviewDto[]; total: number; averageRating: number; ratingCounts: any[] }> {
    // Find the cheek first to get its ID
    // Note: `findCheekByUsernameAndSlug` in `CheeksService` does NOT do its own visibility check.
    // Visibility for direct cheek access via slug is handled by `CheekVisibilityGuard` in `CheeksController`.
    // Here, it is accessed indirectly, so it needs to be checked after fetching the cheek.
    const cheek = await this.cheeksService.findCheekByUsernameAndSlug(username, cheekSlug);

    if (!cheek || !cheek._id) {
      throw new NotFoundException(`Cheek with slug '${cheekSlug}' by user '${username}' not found.`);
    }

    // Perform visibility check using the fetched cheek's ID
    await this._ensureCheekIsViewable(cheek._id.toString(), requestingUserId);

    // Now call the original method with the cheekId
    return this.getReviewsForCheek(
      cheek._id.toString(),
      page,
      limit,
      sortBy,
      sortOrder,
      starRating,
      requestingUserId,
    );
  }

  async getReviewById(id: string, requestingUserId?: string): Promise<TransformedReviewDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid review ID format.');
    }
    const review = await this.reviewModel
      .findById(id)
      .populate({
        path: 'userId',
        select: '_id username profileImageUrl',
      })
      .populate({
        path: 'cheekId',
        select: 'title slug owner isPublic',
      })
      .lean()
      .exec();

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check visibility of the associated cheek
    const cheekFromReview = review.cheekId as any;

    if (cheekFromReview && cheekFromReview.isPublic === false) {
      const cheekOwnerId = cheekFromReview.owner?.toString();
      if (!requestingUserId || cheekOwnerId !== requestingUserId) {
        throw new ForbiddenException('You do not have permission to view this review as it belongs to a private cheek.');
      }
    }

    return this._transformReview(review);
  }

  /**
   * Update an existing review (only by the review owner)
   */
  async updateReview(reviewId: string, updateReviewDto: UpdateReviewDto, userId: string): Promise<TransformedReviewDto> {
    this._validateObjectId(reviewId, 'Review');

    const reviewToUpdate = await this.reviewModel.findOne({
      _id: new Types.ObjectId(reviewId),
      userId: new Types.ObjectId(userId)
    });

    if (!reviewToUpdate) {
      throw new NotFoundException(
        `Review with ID \"${reviewId}\" not found or you do not have permission to update it.`,
      );
    }

    // Apply updates
    Object.assign(reviewToUpdate, updateReviewDto);
    const updatedReviewDoc = await reviewToUpdate.save();
    await this.cheeksService.recalculateAndUpdateCheekStats(reviewToUpdate.cheekId);

    // Populate and transform
    const populatedReview = await this.reviewModel
      .findById(updatedReviewDoc._id)
      .populate<{ userId: { _id: Types.ObjectId, username: string, profileImageUrl?: string } }>({
        path: 'userId',
        select: '_id username profileImageUrl',
      })
      .lean()
      .exec();

    if (!populatedReview) {
      throw new InternalServerErrorException('Failed to retrieve and populate review after update.');
    }

    return this._transformReview(populatedReview);
  }

  /**
   * Delete a review (only by the review owner)
   */
  async deleteReview(reviewId: string, userId: string): Promise<{ message: string }> {
    this._validateObjectId(reviewId, 'Review');

    // Find the review to get the cheekId before deletion
    const reviewToDelete = await this.reviewModel.findOne({
      _id: new Types.ObjectId(reviewId),
      userId: new Types.ObjectId(userId)
    });

    if (!reviewToDelete) {
      throw new NotFoundException(
        `Review with ID \"${reviewId}\" not found or you do not have permission to delete it.`,
      );
    }

    const cheekId = reviewToDelete.cheekId;

    const deleteResult = await this.reviewModel.deleteOne(
      { _id: new Types.ObjectId(reviewId), userId: new Types.ObjectId(userId) }
    ).exec();

    if (deleteResult.deletedCount === 0) {
      throw new NotFoundException(
        `Review with ID \"${reviewId}\" not found or you do not have permission to delete it.`,
      );
    }
    await this.cheeksService.recalculateAndUpdateCheekStats(cheekId);

    return { message: 'Review deleted successfully' };
  }
}

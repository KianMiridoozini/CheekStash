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
  // --- Properties ---
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private readonly cheeksService: CheeksService,
    private readonly usersService: UsersService,
  ) { }

  // --- Public Methods ---

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
      const savedReviewDoc = await this._createNewReviewDocument(createReviewDto, userId, username);
      await this.cheeksService.recalculateAndUpdateCheekStats(createReviewDto.cheekId);
      const populatedReview = await this._populateReview(savedReviewDoc._id as Types.ObjectId);
      return this._transformReview(populatedReview);
    } catch (error) {
      if (error.code === 11000) {
        throw new ConflictException('You have already submitted a review for this cheek (database constraint).');
      }
      if (error instanceof InternalServerErrorException || error instanceof ConflictException || error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create review: ' + (error.message || 'Unknown error'),
      );
    }
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
    await this._ensureCheekIsViewable(cheekId, requestingUserId);
    const cheekObjectId = new Types.ObjectId(cheekId);
    return this._fetchAndProcessReviewsForCheek(cheekObjectId, page, limit, sortBy, sortOrder, starRating);
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
    const cheek = await this.cheeksService.findCheekByUsernameAndSlug(username, cheekSlug);
    if (!cheek || !cheek._id) {
      throw new NotFoundException(`Cheek with slug '${cheekSlug}' by user '${username}' not found.`);
    }
    await this._ensureCheekIsViewable(cheek._id.toString(), requestingUserId);
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
    const review = await this._fetchReviewAndCheckVisibility(id, requestingUserId);
    return this._transformReview(review);
  }

  /**
   * Update an existing review (only by the review owner)
   */
  async updateReview(reviewId: string, updateReviewDto: UpdateReviewDto, userId: string): Promise<TransformedReviewDto> {
    const reviewToUpdate = await this._findUserReviewForUpdate(reviewId, userId);
    const updatedReviewDoc = await this._applyUpdatesSaveAndRecalculate(reviewToUpdate, updateReviewDto);
    const populatedReview = await this._populateReview(updatedReviewDoc._id as Types.ObjectId);
    return this._transformReview(populatedReview);
  }

  /**
   * Delete a review (only by the review owner)
   */
  async deleteReview(reviewId: string, userId: string): Promise<{ message: string }> {
    const { cheekId: reviewCheekId } = await this._findUserReviewForDeletion(reviewId, userId);
    await this._performDeletionAndRecalculateStats(new Types.ObjectId(reviewId), new Types.ObjectId(userId), reviewCheekId);
    return { message: 'Review deleted successfully' };
  }

  // --- Private Helper Methods ---

  // --- Validation & Authorization Helpers ---
  private _validateObjectId(id: string, entityName: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${entityName} ID format: "${id}".`);
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

  private async _ensureCheekIsViewable(cheekId: string, requestingUserId?: string): Promise<void> {
    const cheekInfo = await this.cheeksService.findCheekOwnerAndVisibility(cheekId);
    if (!cheekInfo) {
      console.error(`[ReviewsService] Cheek NOT FOUND in _ensureCheekIsViewable for cheekId: ${cheekId}`);
      throw new NotFoundException(`Cheek with ID "${cheekId}" not found.`);
    }
    const ownerIdString = this._extractOwnerIdString(cheekInfo.owner);
    this._assertCheekViewableByUser(cheekInfo.isPublic, ownerIdString, requestingUserId);
  }

  // --- Owner/Visibility Extraction Helpers ---
  private _extractOwnerIdString(owner: any): string | undefined {
    if (!owner) return undefined;
    if (typeof owner === 'object' && '_id' in owner && owner._id) {
      if (owner._id instanceof Types.ObjectId) {
        return owner._id.toString();
      } else if (typeof owner._id === 'string' && Types.ObjectId.isValid(owner._id)) {
        return owner._id;
      } else {
        console.warn(`[ReviewsService] owner._id is present but not a valid ObjectId or string:`, owner._id);
        return undefined;
      }
    }
    if (owner instanceof Types.ObjectId) {
      return owner.toString();
    }
    if (typeof owner === 'string' && Types.ObjectId.isValid(owner)) {
      return owner;
    }
    console.warn(`[ReviewsService] Unhandled owner structure:`, owner);
    return undefined;
  }

  private _assertCheekViewableByUser(isPublic: boolean, ownerIdString: string | undefined, requestingUserId?: string): void {
    if (!isPublic) {
      if (!requestingUserId) {
        console.error(`[ReviewsService] Visibility Check FAIL (Private Cheek, No Requesting User): isPublic=${isPublic}, requestingUserId=${requestingUserId}`);
        throw new ForbiddenException('You do not have permission to view reviews for this private cheek (not logged in).');
      }
      if (ownerIdString !== requestingUserId) {
        console.error(`[ReviewsService] Visibility Check FAIL (Private Cheek, Mismatch): isPublic=${isPublic}, requestingUserId=${requestingUserId}, ownerIdString=${ownerIdString}, match: ${ownerIdString === requestingUserId}`);
        throw new ForbiddenException('You do not have permission to view reviews for this private cheek (not owner).');
      }
    }
  }

  // --- Review CRUD Helpers ---
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

  private async _createNewReviewDocument(
    createReviewDto: CreateReviewDto,
    userId: string,
    username: string,
  ): Promise<ReviewDocument> {
    const newReview = new this.reviewModel({
      ...createReviewDto,
      cheekId: new Types.ObjectId(createReviewDto.cheekId),
      userId: new Types.ObjectId(userId),
      username,
    });
    return newReview.save();
  }

  private async _populateReview(reviewId: Types.ObjectId): Promise<any> {
    const populatedReview = await this.reviewModel
      .findById(reviewId)
      .populate<{ userId: { _id: Types.ObjectId, username: string, profileImageUrl?: string } }>(
        { path: 'userId', select: '_id username profileImageUrl' },
      )
      .lean()
      .exec();
    if (!populatedReview) {
      throw new InternalServerErrorException('Failed to retrieve and populate review post-operation.');
    }
    return populatedReview;
  }

  private async _findUserReviewForUpdate(reviewId: string, userId: string): Promise<ReviewDocument> {
    this._validateObjectId(reviewId, 'Review');
    const reviewToUpdate = await this.reviewModel.findOne({
      _id: new Types.ObjectId(reviewId),
      userId: new Types.ObjectId(userId)
    });
    if (!reviewToUpdate) {
      throw new NotFoundException(
        `Review with ID "${reviewId}" not found or you do not have permission to update it.`,
      );
    }
    return reviewToUpdate;
  }

  private async _applyUpdatesSaveAndRecalculate(
    review: ReviewDocument,
    updateReviewDto: UpdateReviewDto,
  ): Promise<ReviewDocument> {
    Object.assign(review, updateReviewDto);
    const updatedReviewDoc = await review.save();
    await this.cheeksService.recalculateAndUpdateCheekStats(review.cheekId);
    return updatedReviewDoc;
  }

  private async _findUserReviewForDeletion(reviewId: string, userId: string): Promise<{ review: ReviewDocument, cheekId: Types.ObjectId }> {
    this._validateObjectId(reviewId, 'Review');
    const reviewToDelete = await this.reviewModel.findOne({
      _id: new Types.ObjectId(reviewId),
      userId: new Types.ObjectId(userId)
    });
    if (!reviewToDelete) {
      throw new NotFoundException(
        `Review with ID "${reviewId}" not found or you do not have permission to delete it.`,
      );
    }
    return { review: reviewToDelete, cheekId: reviewToDelete.cheekId as Types.ObjectId };
  }

  private async _performDeletionAndRecalculateStats(
    reviewId: Types.ObjectId,
    userId: Types.ObjectId,
    cheekId: Types.ObjectId
  ): Promise<void> {
    const deleteResult = await this.reviewModel.deleteOne(
      { _id: reviewId, userId: userId }
    ).exec();
    if (deleteResult.deletedCount === 0) {
      throw new NotFoundException(
        `Review with ID "${reviewId}" not found or you do not have permission to delete it (during deletion step).`,
      );
    }
    await this.cheeksService.recalculateAndUpdateCheekStats(cheekId.toString());
  }

  private async _fetchAndProcessReviewsForCheek(
    cheekObjectId: Types.ObjectId,
    page: number,
    limit: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
    starRating?: number,
  ): Promise<{ reviews: TransformedReviewDto[]; total: number; averageRating: number; ratingCounts: any[] }> {
    const skip = (page - 1) * limit;
    const sortParams: { [key: string]: 1 | -1 } = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const filterParams: any = { cheekId: cheekObjectId };
    if (starRating !== undefined && !isNaN(starRating)) {
      filterParams.rating = starRating;
    }
    const total = await this.reviewModel.countDocuments(filterParams);
    if (total === 0) {
      return { reviews: [], total: 0, averageRating: 0, ratingCounts: [] };
    }
    const reviewsFromDb = await this.reviewModel
      .find(filterParams)
      .sort(sortParams)
      .skip(skip)
      .limit(limit)
      .populate<{ userId: { _id: Types.ObjectId, username: string } | Types.ObjectId }>('userId', '_id username')
      .lean()
      .exec();
    const allReviewsForStats = await this.reviewModel.find({ cheekId: cheekObjectId }).select('rating').lean().exec();
    const sumOfRatings = allReviewsForStats.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = allReviewsForStats.length > 0 ? sumOfRatings / allReviewsForStats.length : 0;
    const ratingCounts = Object.entries(
      allReviewsForStats.reduce((counts, review) => {
        counts[review.rating] = (counts[review.rating] || 0) + 1;
        return counts;
      }, {} as Record<number, number>)
    ).map(([rating, count]) => ({ rating: Number(rating), count }));
    return {
      reviews: reviewsFromDb.map(review => this._transformReview(review)),
      total,
      averageRating,
      ratingCounts,
    };
  }

  private async _fetchReviewAndCheckVisibility(reviewIdString: string, requestingUserId?: string): Promise<any> {
    this._validateObjectId(reviewIdString, 'Review');
    const review = await this.reviewModel
      .findById(reviewIdString)
      .populate<{ userId: { _id: Types.ObjectId, username: string, profileImageUrl?: string } }>(
        { path: 'userId', select: '_id username profileImageUrl' },
      )
      .populate<{ cheekId: { _id: Types.ObjectId, title: string, slug: string, owner: Types.ObjectId | { _id: Types.ObjectId }, isPublic: boolean } }>(
        { path: 'cheekId', select: 'title slug owner isPublic' },
      )
      .lean()
      .exec();
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    const cheekFromReview = review.cheekId;
    if (cheekFromReview && cheekFromReview.isPublic === false) {
      let cheekOwnerId: string | undefined;
      if (cheekFromReview.owner && typeof cheekFromReview.owner === 'object' && '_id' in cheekFromReview.owner) {
        cheekOwnerId = cheekFromReview.owner._id.toString();
      } else if (typeof cheekFromReview.owner === 'string' && Types.ObjectId.isValid(cheekFromReview.owner)) {
        cheekOwnerId = cheekFromReview.owner;
      }
      if (cheekOwnerId !== requestingUserId) {
        throw new ForbiddenException('You do not have permission to view this review on a private cheek.');
      }
    }
    return review;
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, SortOrder, model } from 'mongoose';
import { Cheeks, CheeksDocument } from './schemas/cheek.schema';
import { CheeksDto } from './dto/cheeks.dto';
import { UpdateCheeksDto } from './dto/update-cheeks.dto';
import { UpdateCheekVisibilityDto } from './dto/update-cheek-visibility.dto';
import { QueryCheeksDto } from './dto/query-cheeks.dto';
import { CategoriesService } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { UsersService } from '../users/users.service';
import { assertUserFound } from '../common/guards/user-check.util';
import { assertCheekFound } from '../common/guards/cheek-check.util';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';
import { CategoryDocument } from '../categories/schema/category.schema';
import { TagDocument } from '../tags/schema/tag.schema';

// Helper function to generate a slug
function generateSlug(title: string): string {
  if (!title) return '';
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except hyphens
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

// Type alias for Mongoose sort options
type MongooseSortOptions = { [key: string]: SortOrder | { $meta: string } } | string;

// Constants for getCheekSuggestions
const cheekSuggestionsFieldsToSelect = 'title slug isPublic createdAt';
// const cheekSuggestionsOwnerToPopulate = { path: 'owner', select: 'username' };

// Constants for getCheeksByUserId
const profileCheekFieldsToSelect = '_id title slug description owner isPublic createdAt updatedAt';

// Constants for sorting
const sortOptionsCreatedAt: MongooseSortOptions = { createdAt: -1 };


@Injectable()
export class CheeksService {
  // private readonly logger = new Logger(CheeksService.name); 

  // Constants for query projections and population

  constructor(
    @InjectModel(Cheeks.name)
    private CheeksModel: Model<CheeksDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
    private readonly usersService: UsersService,
  ) { }

  private readonly cheekPopulationPaths = [
    { path: 'owner', select: '-passwordHash' },
    { path: 'categoryId' },
    { path: 'tagIds', model: 'Tag' }, // Explicitly specify the model for population
  ];

  private readonly cheekListPopulationPaths = [
    { path: 'owner', select: '_id username' },
    { path: 'categoryId', select: '_id name' },
    { path: 'tagIds', model: 'Tag', select: '_id name' },
  ];

  private readonly profileCheekPopulationPaths = [
    { path: 'owner', select: 'username' },
  ];

  // Private helper to get review stats for a single cheek
  private async _getReviewStatsForCheek(cheekId: Types.ObjectId): Promise<{ averageRating: number; reviewCount: number }> {
    const stats = await this.reviewModel.aggregate([
      { $match: { cheekId: cheekId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      return {
        averageRating: parseFloat(stats[0].averageRating.toFixed(1)) || 0,
        reviewCount: stats[0].reviewCount || 0,
      };
    }
    return { averageRating: 0, reviewCount: 0 };
  }

  // Private helper to get review stats for multiple cheeks
  private async _getReviewStatsForCheeks(cheekIds: Types.ObjectId[]): Promise<Map<string, { averageRating: number; reviewCount: number }>> {
    if (!cheekIds || cheekIds.length === 0) {
      return new Map();
    }
    const stats = await this.reviewModel.aggregate([
      { $match: { cheekId: { $in: cheekIds } } },
      {
        $group: {
          _id: '$cheekId',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 },
        },
      },
    ]);

    const statsMap = new Map<string, { averageRating: number; reviewCount: number }>();
    stats.forEach(stat => {
      statsMap.set(stat._id.toString(), {
        averageRating: parseFloat(stat.averageRating.toFixed(1)) || 0,
        reviewCount: stat.reviewCount || 0,
      });
    });
    return statsMap;
  }

  private async _prepareTagsForCreation(tagNames?: string[]): Promise<Types.ObjectId[]> {
    if (!tagNames || tagNames.length === 0) {
      return [];
    }
    const tagObjects = await this.tagsService.findOrCreateTags(tagNames);
    return tagObjects.map(tag => tag._id);
  }

  private async _updateTagUsageCounts(oldTagIds: string[], newTagIds: string[]): Promise<void> {
    const oldTagSet = new Set(oldTagIds);
    const newTagSet = new Set(newTagIds);

    for (const tagId of oldTagSet) {
      if (!newTagSet.has(tagId)) {
        await this.tagsService.updateTagUsageCount(tagId, -1);
      }
    }

    for (const tagId of newTagSet) {
      if (!oldTagSet.has(tagId)) {
        await this.tagsService.updateTagUsageCount(tagId, 1);
      }
    }
  }

  private async _validateAndFetchOwnedCheek(id: string, ownerId: string): Promise<CheeksDocument> {
    // this.logger.log(`Validating and fetching cheek with ID: "${id}" for owner: "${ownerId}"`);

    if (!Types.ObjectId.isValid(id)) {
      // this.logger.warn(`Invalid cheek ID format: "${id}"`);
      throw new BadRequestException('Invalid cheek ID format.');
    }

    const cheek = await this.CheeksModel.findById(id)
      .select('+owner +tagIds')
      .populate('tagIds')
      .exec();

    if (!cheek) {
      // this.logger.warn(`Cheek with ID "${id}" not found.`);
      throw new NotFoundException(`Cheek with ID "${id}" not found.`);
    }

    const cheekOwnerId = cheek.owner?._id?.toString() || cheek.owner?.toString();
    if (cheekOwnerId !== ownerId) {
      // this.logger.warn(
      //   `User "${ownerId}" is not authorized to access cheek "${id}" owned by "${cheekOwnerId}".`,
      // );
      throw new ForbiddenException('You are not authorized to perform this action on this cheek.');
    }
    // this.logger.log(`Successfully validated and fetched cheek ID: "${id}" for owner: "${ownerId}"`);
    return cheek;
  }

  async findCheekOwnerAndVisibility(cheekId: string): Promise<{ owner: { _id: Types.ObjectId } | Types.ObjectId; isPublic: boolean } | null> {
    if (!Types.ObjectId.isValid(cheekId)) {
      return null;
    }
    const cheek = await this.CheeksModel.findById(cheekId)
      .select('owner isPublic')
      .populate<{ owner: { _id: Types.ObjectId } }>({ path: 'owner', select: '_id' })
      .lean()
      .exec();

    return cheek as { owner: { _id: Types.ObjectId } | Types.ObjectId; isPublic: boolean } | null;
  }

  async findCheekOwnerAndVisibilityBySlug(username: string, cheekSlug: string): Promise<{ owner: Types.ObjectId; isPublic: boolean } | null> {
    const user = await this.usersService.findUserByUsername(username);
    if (!user) {
      return null;
    }

    const cheek = await this.CheeksModel.findOne({ owner: user._id, slug: cheekSlug })
      .select('isPublic')
      .lean()
      .exec();

    if (!cheek) {
      return null;
    }
    return { owner: user._id as Types.ObjectId, isPublic: cheek.isPublic };
  }

  async createCheeks(cheeksDto: CheeksDto, ownerId: string): Promise<CheeksDocument> {
    await this.categoriesService.findOne(cheeksDto.categoryId);

    const tagIds = await this._prepareTagsForCreation(cheeksDto.tagNames);
    const slug = await this.generateUniqueSlug(cheeksDto.title, ownerId);

    const newCheeksData = {
      ...cheeksDto,
      categoryId: new Types.ObjectId(cheeksDto.categoryId),
      slug,
      tagIds,
      owner: new Types.ObjectId(ownerId),
    };

    const newCheeks = new this.CheeksModel(newCheeksData);

    try {
      let savedCheek = await newCheeks.save();
      savedCheek = await savedCheek.populate(this.cheekPopulationPaths);
      return savedCheek;
    } catch (error: any) {
      if (error.code === 11000 && error.keyPattern && (error.keyPattern.slug || (error.keyPattern.owner && error.keyPattern.slug))) {
        throw new InternalServerErrorException(
          `Failed to create a unique slug for title: "${cheeksDto.title}". This might happen if the title is too similar to an existing one for this user. Please try modifying the title slightly.`,
        );
      }
      throw new InternalServerErrorException('Error saving new Cheeks: ' + error.message);
    }
  }

  // Renamed from getCheeks to getCheeksPaginated
  async getCheeksPaginated(queryDto?: QueryCheeksDto, requestingUserId?: string): Promise<{ cheeks: CheeksDocument[], totalItems: number }> {
    const { searchKeyword, categoryIds, tagIds, page = 1, limit = 10 } = queryDto || {};
    // this.logger.debug(`getCheeksPaginated - queryDto: ${JSON.stringify(queryDto)}`); // Log DTO

    const query: FilterQuery<CheeksDocument> = {};
    const filterConditions: FilterQuery<CheeksDocument>[] = [];

    if (categoryIds && categoryIds.length > 0) {
      query.categoryId = { $in: categoryIds.map(id => new Types.ObjectId(id)) };
    }

    if (tagIds && tagIds.length > 0) {
      query.tagIds = { $in: tagIds.map(id => new Types.ObjectId(id)) };
    }

    // Visibility conditions
    const visibilityQueryPart: FilterQuery<CheeksDocument> = {};
    if (requestingUserId) {
      visibilityQueryPart.$or = [
        { isPublic: true },
        { owner: new Types.ObjectId(requestingUserId) },
      ];
    } else {
      visibilityQueryPart.isPublic = true;
    }
    filterConditions.push(visibilityQueryPart);

    // Search keyword conditions using regex
    if (searchKeyword && searchKeyword.trim().length > 0) { // Ensure searchKeyword is not empty
      const regex = new RegExp(searchKeyword.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i'); // 'i' for case-insensitive
      filterConditions.push({
        $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
        ],
      });
    }

    if (filterConditions.length > 0) {
      query.$and = filterConditions;
    }

    // this.logger.debug(`getCheeksPaginated - MongoDB query: ${JSON.stringify(query)}`); // Log constructed query

    const skip = (page - 1) * limit;

    sortOptionsCreatedAt

    const [cheeksResults, totalItems] = await Promise.all([
      this.CheeksModel.find(query)
        .select('-links')
        .populate(this.cheekListPopulationPaths)
        .sort(sortOptionsCreatedAt)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.CheeksModel.countDocuments(query).exec(),
    ]);

    const cheekIds = cheeksResults.map(c => c._id as Types.ObjectId); // _id is available on lean objects
    const reviewStatsMap = await this._getReviewStatsForCheeks(cheekIds);

    const cheeksWithStats = cheeksResults.map(cheek => { // cheek is now a plain object
      const stats = reviewStatsMap.get((cheek._id as Types.ObjectId).toString());
      return {
        ...cheek, // Spread the plain cheek object
        averageRating: stats?.averageRating ?? 0,
        reviewCount: stats?.reviewCount ?? 0,
      } as unknown as CheeksDocument; // Future Change:Ideally use a DTO for response
    });

    return { cheeks: cheeksWithStats, totalItems };
  }

  async getCheekSuggestions(queryDto?: QueryCheeksDto, requestingUserId?: string): Promise<CheeksDocument[]> {
    const { searchKeyword, limit = 5 } = queryDto || {}; // Default limit for suggestions
    // this.logger.debug(`getCheekSuggestions - queryDto: ${JSON.stringify(queryDto)}`); // Log DTO

    if (!searchKeyword || searchKeyword.trim().length < 2) {
      // this.logger.debug('getCheekSuggestions - searchKeyword too short or not provided, returning empty array.');
      return [];
    }

    const searchRegex = new RegExp(searchKeyword.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');

    const searchConditionsPart: FilterQuery<CheeksDocument> = {
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ],
    };

    const visibilityConditionsPart: FilterQuery<CheeksDocument> = {};
    if (requestingUserId) {
      visibilityConditionsPart.$or = [
        { isPublic: true },
        { owner: new Types.ObjectId(requestingUserId) },
      ];
    } else {
      visibilityConditionsPart.isPublic = true;
    }

    const query: FilterQuery<CheeksDocument> = {
      $and: [visibilityConditionsPart, searchConditionsPart],
    };

    // this.logger.debug(`getCheekSuggestions - MongoDB query: ${JSON.stringify(query)}`);

    sortOptionsCreatedAt;

    const suggestions = await this.CheeksModel.find(query)
      .select(cheekSuggestionsFieldsToSelect) // Use constant for selected fields
      .sort(sortOptionsCreatedAt)
      .limit(limit)
      .lean()
      .exec();

    return suggestions as CheeksDocument[]; // Lean objects, cast to CheeksDocument (ideally a DTO)
  }

  async getCheeksById(id: string, requestingUserId?: string): Promise<CheeksDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    const cheekDoc = await this.CheeksModel.findById(id)
      .populate(this.cheekPopulationPaths)
      .lean()
      .exec();

    assertCheekFound(cheekDoc, 'Cheek not found');

    const stats = await this._getReviewStatsForCheek(cheekDoc._id as Types.ObjectId);
    (cheekDoc as any).averageRating = stats.averageRating;
    (cheekDoc as any).reviewCount = stats.reviewCount;

    return cheekDoc as CheeksDocument;
  }

  async findCheekByUsernameAndSlug(
    username: string,
    cheekSlug: string,
    requestingUserId?: string,
  ): Promise<CheeksDocument> {
    const user = await this.usersService.findUserByUsername(username);
    assertUserFound(user);

    const cheekBySlug = await this.CheeksModel.findOne({
      owner: user._id,
      slug: cheekSlug,
    })
      .populate(this.cheekPopulationPaths)
      .lean()
      .exec();

    assertCheekFound(cheekBySlug, `Cheek with slug '${cheekSlug}' by user '${username}' not found.`);

    const stats = await this._getReviewStatsForCheek(cheekBySlug._id as Types.ObjectId);
    (cheekBySlug as any).averageRating = stats.averageRating;
    (cheekBySlug as any).reviewCount = stats.reviewCount;

    return cheekBySlug as CheeksDocument;
  }

  async getCheeksByUserId(userIdToFetchFor: string, requestingUserId?: string): Promise<CheeksDocument[]> {
    if (!Types.ObjectId.isValid(userIdToFetchFor)) {
      throw new NotFoundException(`Invalid user ID format: "${userIdToFetchFor}".`);
    }

    const fieldsToSelect = profileCheekFieldsToSelect;
    const queryConditions: FilterQuery<CheeksDocument> = { owner: new Types.ObjectId(userIdToFetchFor) };

    if (!requestingUserId || requestingUserId !== userIdToFetchFor) {
      queryConditions.isPublic = true;
    }

    const queryResults = await this.CheeksModel.find(queryConditions)
      .select(fieldsToSelect)
      .populate(this.profileCheekPopulationPaths)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return queryResults as CheeksDocument[];
  }

  async updateCheeks(
    id: string,
    updateCheeksDto: UpdateCheeksDto,
    ownerId: string,
  ): Promise<CheeksDocument> {
    const cheek = await this.CheeksModel.findById(id).exec();
    assertCheekFound(cheek, 'Cheek not found for update');

    if (cheek.owner.toString() !== ownerId) {
      throw new ForbiddenException('You can only update your own cheeks.');
    }

    if (updateCheeksDto.categoryId) {
      await this.categoriesService.findOne(updateCheeksDto.categoryId);
      (updateCheeksDto as any).categoryId = new Types.ObjectId(updateCheeksDto.categoryId);
    }

    if (updateCheeksDto.tagNames) {
      const oldTagIds = cheek.tagIds.map(tag => tag.toString());
      const newTagObjects = await this._prepareTagsForCreation(updateCheeksDto.tagNames);
      (updateCheeksDto as any).tagIds = newTagObjects.map(tag => tag._id);

      await this._updateTagUsageCounts(oldTagIds, (updateCheeksDto as any).tagIds.map((id: Types.ObjectId) => id.toString()));
      delete updateCheeksDto.tagNames;
    }

    if (updateCheeksDto.title && updateCheeksDto.title !== cheek.title) {
      (updateCheeksDto as any).slug = await this.generateUniqueSlug(updateCheeksDto.title, ownerId, id);
    }

    Object.assign(cheek, updateCheeksDto);
    let updatedCheek = await cheek.save();
    updatedCheek = await updatedCheek.populate(this.cheekPopulationPaths);
    return updatedCheek;
  }

  async updateCheekVisibility(
    id: string,
    updateDto: UpdateCheekVisibilityDto,
    ownerId: string,
  ): Promise<CheeksDocument> {
    const cheek = await this.CheeksModel.findById(id).exec();
    assertCheekFound(cheek, 'Cheek not found for visibility update');

    if (cheek.owner.toString() !== ownerId) {
      throw new ForbiddenException('You can only update the visibility of your own cheeks.');
    }

    cheek.isPublic = updateDto.isPublic;
    let updatedCheek = await cheek.save();
    updatedCheek = await updatedCheek.populate(this.cheekPopulationPaths);
    return updatedCheek;
  }

  async deleteCheeks(id: string, ownerId: string): Promise<void> {
    // this.logger.log(`Attempting to delete cheek with ID: "${id}" by owner: "${ownerId}"`);

    const cheek = await this._validateAndFetchOwnedCheek(id, ownerId);

    try {
      // 1. Delete related reviews
      const reviewDeletionResult = await this.reviewModel
        .deleteMany({ cheekId: cheek._id as Types.ObjectId })
        .exec();
      // this.logger.log(
      //   `Deleted ${reviewDeletionResult.deletedCount} reviews for cheek ID: "${id}"`,
      // );

      // 2. Update tag usage counts
      if (cheek.tagIds && cheek.tagIds.length > 0) {
        const tagIdsToDecrement = cheek.tagIds.map(tag => {
          if (tag instanceof Types.ObjectId) {
            return tag.toString();
          }
          return (tag as TagDocument)._id.toString();
        });
        await this._updateTagUsageCounts(
          tagIdsToDecrement,
          [],
        );
        // this.logger.log(`Updated tag usage counts for cheek ID: "${id}"`);
      }

      // 3. Delete the cheek itself
      const deletionResult = await this.CheeksModel.findByIdAndDelete(cheek._id).exec();
      if (!deletionResult) {
        // This case should ideally be caught by the initial findById check,
        // but as a safeguard if something changed between find and delete.
        // this.logger.warn(`Cheek with ID "${id}" was not found during findByIdAndDelete, though it was found earlier.`);
        throw new NotFoundException(`Cheek with ID "${id}" not found during final delete operation.`);
      }
      // this.logger.log(`Successfully deleted cheek with ID: "${id}"`);

    } catch (error: any) {
      // Catch specific errors if needed, otherwise rethrow or handle as InternalServerError
      if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error; // Re-throw known exceptions
      }
      // this.logger.error(
      //   `Error during deletion process for cheek ID "${id}": ${error.message}`,
      //   error.stack,
      // );
      throw new InternalServerErrorException(
        `Could not delete cheek "${id}" due to an internal error.`,
      );
    }
  }

  async generateUniqueSlug(title: string, ownerId: string, excludeCheekId?: string): Promise<string> {
    let baseSlug = generateSlug(title);
    if (!baseSlug) {
      baseSlug = 'cheek';
    }
    let uniqueSlug = baseSlug;
    let counter = 0;
    let isUnique = false;

    while (!isUnique) {
      const query: any = { slug: uniqueSlug, owner: new Types.ObjectId(ownerId) };
      if (excludeCheekId) {
        query._id = { $ne: new Types.ObjectId(excludeCheekId) };
      }
      const existingCheek = await this.CheeksModel.findOne(query).exec();
      if (!existingCheek) {
        isUnique = true;
      } else {
        counter++;
        uniqueSlug = `${baseSlug}-${counter}`;
      }
    }
    return uniqueSlug;
  }
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
  Logger, // Assuming Logger might be used later, keeping import
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, SortOrder } from 'mongoose'; // Removed 'model' as it's not used
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
// import { CategoryDocument } from '../categories/schema/category.schema'; // Not directly used in this file
import { TagDocument } from '../tags/schema/tag.schema';

// Helper function to generate a slug (remains unchanged)
function generateSlug(title: string): string {
  if (!title) return '';
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Type alias for Mongoose sort options (remains unchanged)
type MongooseSortOptions = { [key: string]: SortOrder | { $meta: string } } | string;

// Constants (remains unchanged)
const cheekSuggestionsFieldsToSelect = 'title slug isPublic createdAt';
const profileCheekFieldsToSelect = '_id title slug description owner isPublic createdAt updatedAt';
const sortOptionsCreatedAt: MongooseSortOptions = { createdAt: -1 };

@Injectable()
export class CheeksService {
  // private readonly logger = new Logger(CheeksService.name);

  // --- Properties ---
  private readonly cheekPopulationPaths = [
    { path: 'owner', select: '-passwordHash' },
    { path: 'categoryId' },
    { path: 'tagIds', model: 'Tag' },
  ];

  private readonly cheekListPopulationPaths = [
    { path: 'owner', select: '_id username' },
    { path: 'categoryId', select: '_id name' },
    { path: 'tagIds', model: 'Tag', select: '_id name' },
  ];

  private readonly profileCheekPopulationPaths = [
    { path: 'owner', select: 'username' },
  ];

  constructor(
    @InjectModel(Cheeks.name)
    private CheeksModel: Model<CheeksDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private readonly categoriesService: CategoriesService,
    private readonly tagsService: TagsService,
    private readonly usersService: UsersService,
  ) { }

  // --- Public Methods ---

  // --- Cheek Information Retrieval ---
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
    if (!user) return null;

    const cheek = await this.CheeksModel.findOne({ owner: user._id, slug: cheekSlug })
      .select('isPublic')
      .lean()
      .exec();
    if (!cheek) return null;

    return { owner: user._id as Types.ObjectId, isPublic: cheek.isPublic };
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
    await this._attachReviewStatsToCheek(cheekDoc); // Modifies cheekDoc (lean object) in place

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
    await this._attachReviewStatsToCheek(cheekBySlug); // Modifies cheekBySlug (lean object) in place

    return cheekBySlug as CheeksDocument;
  }

  async getCheeksByUserId(userIdToFetchFor: string, requestingUserId?: string): Promise<CheeksDocument[]> {
    if (!Types.ObjectId.isValid(userIdToFetchFor)) {
      throw new NotFoundException(`Invalid user ID format: "${userIdToFetchFor}".`);
    }

    const queryConditions: FilterQuery<CheeksDocument> = { owner: new Types.ObjectId(userIdToFetchFor) };
    if (!requestingUserId || requestingUserId !== userIdToFetchFor) {
      queryConditions.isPublic = true;
    }

    const queryResults = await this.CheeksModel.find(queryConditions)
      .select(profileCheekFieldsToSelect) // Use constant
      .populate(this.profileCheekPopulationPaths)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return queryResults as CheeksDocument[];
  }

  // --- Cheeks Querying and Listing ---
  async getCheeksPaginated(queryDto?: QueryCheeksDto, requestingUserId?: string): Promise<{ cheeks: CheeksDocument[], totalItems: number }> {
    const { page = 1, limit = 10 } = queryDto || {};
    const query = this._buildCheeksQuery(queryDto, requestingUserId);
    const sortOptions = this._buildCheeksSortOptions(queryDto?.sortBy);
    const skip = (page - 1) * limit;

    const [cheeksResults, totalItems] = await Promise.all([
      this.CheeksModel.find(query)
        .select('-links') // links are not needed in the list view
        .populate(this.cheekListPopulationPaths)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.CheeksModel.countDocuments(query).exec(),
    ]);

    return { cheeks: cheeksResults as CheeksDocument[], totalItems };
  }

  async getCheekSuggestions(queryDto?: QueryCheeksDto, requestingUserId?: string): Promise<CheeksDocument[]> {
    const { searchKeyword, limit = 5 } = queryDto || {};
    if (!searchKeyword || searchKeyword.trim().length < 2) {
      return [];
    }

    const searchConditionsPart = this._buildSearchQueryPart(searchKeyword);
    const visibilityConditionsPart = this._buildVisibilityQueryPart(requestingUserId);

    const query: FilterQuery<CheeksDocument> = {
      $and: [visibilityConditionsPart, searchConditionsPart],
    };

    const suggestions = await this.CheeksModel.find(query)
      .select(cheekSuggestionsFieldsToSelect)
      .sort(sortOptionsCreatedAt)
      .limit(limit)
      .lean()
      .exec();

    return suggestions as CheeksDocument[];
  }

  // --- Cheek Creation ---
  async createCheeks(cheeksDto: CheeksDto, ownerId: string): Promise<CheeksDocument> {
    const newCheeksModelData = await this._prepareCompleteNewCheekData(
      cheeksDto,
      ownerId,
    );
    const newCheek = new this.CheeksModel(newCheeksModelData);

    return this._saveNewCheekInstanceAndFinalize(
      newCheek,
      newCheeksModelData.tagIds, // Pass the processed tag IDs
      cheeksDto.title,
    );
  }

  // --- Cheek Update ---
  async updateCheeks(
    id: string,
    updateCheeksDto: UpdateCheeksDto,
    ownerId: string,
  ): Promise<CheeksDocument> {
    const cheek = await this._getCheekAndVerifyOwnership(id, ownerId);
    const preparedPayload = await this._prepareCheekUpdatePayload(
      updateCheeksDto,
      cheek,
      ownerId,
    );

    return this._applySaveAndPopulateCheekUpdate(
      cheek,
      updateCheeksDto,
      preparedPayload,
    );
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

  // --- Cheek Deletion ---
  async deleteCheeks(id: string, ownerId: string): Promise<void> {
    const cheek = await this._validateAndFetchOwnedCheek(id, ownerId);

    try {
      await this._deleteAssociatedReviews(cheek._id as Types.ObjectId);
      await this._decrementTagCountsForDeletedCheek(cheek.tagIds as unknown as TagDocument[]);
      await this._performCheekDeletion(cheek._id as Types.ObjectId);
    } catch (error: any) {
      this._handleDeleteCheekError(error, id);
    }
  }

  // --- Utility Methods ---
  async generateUniqueSlug(title: string, ownerId: string, excludeCheekId?: string): Promise<string> {
    let baseSlug = generateSlug(title);
    if (!baseSlug) baseSlug = 'cheek';
    let uniqueSlug = baseSlug;
    let counter = 0;
    let isUnique = false;

    while (!isUnique) {
      const query: FilterQuery<CheeksDocument> = { slug: uniqueSlug, owner: new Types.ObjectId(ownerId) };
      if (excludeCheekId) {
        query._id = { $ne: new Types.ObjectId(excludeCheekId) };
      }
      const existingCheek = await this.CheeksModel.findOne(query).lean().exec();
      if (!existingCheek) {
        isUnique = true;
      } else {
        counter++;
        uniqueSlug = `${baseSlug}-${counter}`;
      }
    }
    return uniqueSlug;
  }

  async recalculateAndUpdateCheekStats(cheekId: Types.ObjectId | string): Promise<void> {
    const id = typeof cheekId === 'string' ? new Types.ObjectId(cheekId) : cheekId;
    const stats = await this._getReviewStatsForCheek(id);
    await this.CheeksModel.findByIdAndUpdate(id, {
      averageRating: stats.averageRating,
      reviewCount: stats.reviewCount,
    }).exec();
  }

  // --- Private Helper Methods ---

  // --- Review Stats Helpers ---
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

  private async _attachReviewStatsToCheek(cheekDoc: any): Promise<void> {
    // Modifies a lean document in place
    if (!cheekDoc || !cheekDoc._id) return;
    const stats = await this._getReviewStatsForCheek(cheekDoc._id as Types.ObjectId);
    cheekDoc.averageRating = stats.averageRating;
    cheekDoc.reviewCount = stats.reviewCount;
  }

  // --- Tag Management Helpers ---
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

  private async _incrementInitialTagUsageCounts(tagIds: Types.ObjectId[]): Promise<void> {
    if (tagIds && tagIds.length > 0) {
      for (const tagId of tagIds) {
        await this.tagsService.updateTagUsageCount(tagId.toString(), 1);
      }
    }
  }

  // --- Cheek Validation and Fetching Helpers ---
  private async _validateAndFetchOwnedCheek(id: string, ownerId: string): Promise<CheeksDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid cheek ID format.');
    }
    const cheek = await this.CheeksModel.findById(id)
      .select('+owner +tagIds') // Ensure tagIds is selected for delete operation
      .populate('tagIds') // Populate for delete operation
      .exec();

    assertCheekFound(cheek, `Cheek with ID "${id}" not found.`);

    const cheekOwnerId = cheek.owner?._id?.toString() || cheek.owner?.toString();
    if (cheekOwnerId !== ownerId) {
      throw new ForbiddenException('You are not authorized to perform this action on this cheek.');
    }
    return cheek;
  }

  // --- Cheek Creation Helpers ---

  private async _validateAndGetCategoryObjectId(categoryIdInput: string | Types.ObjectId): Promise<Types.ObjectId> {
    const categoryIdAsString = typeof categoryIdInput === 'string' ? categoryIdInput : categoryIdInput.toString();
    // Assuming categoriesService.findOne throws if not found, thus validating existence.
    await this.categoriesService.findOne(categoryIdAsString);
    return new Types.ObjectId(categoryIdAsString);
  }

  private _handleCreateCheekError(error: any, title: string): never {
    if (error.code === 11000 && error.keyPattern && (error.keyPattern.slug || (error.keyPattern.owner && error.keyPattern.slug))) {
      throw new InternalServerErrorException(
        `Failed to create a unique slug for title: "${title}". This might happen if the title is too similar to an existing one for this user. Please try modifying the title slightly.`,
      );
    }
    // this.logger.error(`Error saving new Cheeks: ${error.message}`, error.stack);
    throw new InternalServerErrorException('Error saving new Cheeks: ' + error.message);
  }

  private async _prepareCompleteNewCheekData(
    cheeksDto: CheeksDto,
    ownerId: string,
  ): Promise<Omit<Cheeks, '_id' | 'createdAt' | 'updatedAt' | 'averageRating' | 'reviewCount' | 'links'> & { owner: Types.ObjectId; categoryId: Types.ObjectId; tagIds: Types.ObjectId[] }> {

    const validatedCategoryId = await this._validateAndGetCategoryObjectId(cheeksDto.categoryId);
    const tagObjectIds = await this._prepareTagsForCreation(cheeksDto.tagNames);
    const slug = await this.generateUniqueSlug(cheeksDto.title, ownerId);

    // Exclude fields handled separately (tagNames, categoryId) from the base data spread from DTO.
    const { tagNames, categoryId, ...baseCheekDataFromDto } = cheeksDto;

    return {
      ...baseCheekDataFromDto, // This will include title and any other direct properties from CheeksDto
      description: cheeksDto.description ?? '',
      isPublic: cheeksDto.isPublic !== undefined ? cheeksDto.isPublic : true,
      categoryId: validatedCategoryId,
      slug: slug,
      tagIds: tagObjectIds,
      owner: new Types.ObjectId(ownerId),
    };
  }

  private async _saveNewCheekInstanceAndFinalize(
    newCheekInstance: CheeksDocument,
    tagObjectIdsToIncrement: Types.ObjectId[], // Pass explicitly for clarity
    originalTitleForError: string,
  ): Promise<CheeksDocument> {
    try {
      let savedCheek = await newCheekInstance.save();
      await this._incrementInitialTagUsageCounts(tagObjectIdsToIncrement);
      savedCheek = await savedCheek.populate(this.cheekPopulationPaths);
      return savedCheek;
    } catch (error: any) {
      this._handleCreateCheekError(error, originalTitleForError); // this will throw
    }
  }

  // --- Cheeks Querying Helpers ---
  private _buildVisibilityQueryPart(requestingUserId?: string): FilterQuery<CheeksDocument> {
    if (requestingUserId) {
      return {
        $or: [
          { isPublic: true },
          { owner: new Types.ObjectId(requestingUserId) },
        ],
      };
    }
    return { isPublic: true };
  }

  private _buildSearchQueryPart(searchKeyword: string): FilterQuery<CheeksDocument> {
    const regex = new RegExp(searchKeyword.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
    return {
      $or: [
        { title: { $regex: regex } },
        { description: { $regex: regex } },
      ],
    };
  }

  private _buildCheeksQuery(queryDto?: QueryCheeksDto, requestingUserId?: string): FilterQuery<CheeksDocument> {
    const { searchKeyword, categoryIds, tagIds } = queryDto || {};
    const query: FilterQuery<CheeksDocument> = {};
    const filterConditions: FilterQuery<CheeksDocument>[] = [];

    if (categoryIds && categoryIds.length > 0) {
      query.categoryId = { $in: categoryIds.map(id => new Types.ObjectId(id)) };
    }
    if (tagIds && tagIds.length > 0) {
      query.tagIds = { $in: tagIds.map(id => new Types.ObjectId(id)) };
    }

    filterConditions.push(this._buildVisibilityQueryPart(requestingUserId));

    if (searchKeyword && searchKeyword.trim().length > 0) {
      filterConditions.push(this._buildSearchQueryPart(searchKeyword));
    }

    if (filterConditions.length > 0) {
      query.$and = filterConditions;
    }
    return query;
  }

  private _buildCheeksSortOptions(sortBy?: string): Record<string, 1 | -1> {
    switch (sortBy) {
      case 'oldest': return { createdAt: 1 };
      case 'rating': return { averageRating: -1, createdAt: -1 }; // Assuming averageRating field exists or will be added
      case 'reviewCount': return { reviewCount: -1, createdAt: -1 }; // Assuming reviewCount field exists
      case 'alpha': return { title: 1, createdAt: -1 };
      case 'alphaDesc': return { title: -1, createdAt: -1 };
      case 'recent': return { createdAt: -1 };
      default: return { createdAt: -1 };
    }
  }

  // --- Update Cheek Helpers ---
  private async _getCheekAndVerifyOwnership(
    id: string,
    ownerId: string,
  ): Promise<CheeksDocument> {
    // .select('+tagIds') ensures tagIds are fetched as an array of ObjectIds, not populated documents,
    // which is needed by _prepareTagsForUpdate.
    const cheek = await this.CheeksModel.findById(id).select('+owner +tagIds').exec();
    assertCheekFound(cheek, 'Cheek not found for update');

    // Ensure owner is loaded for comparison; it's selected above.
    const cheekOwnerId = cheek.owner?._id?.toString() || cheek.owner?.toString();
    if (cheekOwnerId !== ownerId) {
      throw new ForbiddenException('You can only update your own cheeks.');
    }
    return cheek;
  }

  private async _prepareCategoryUpdatePayload(
    updateCheeksDto: UpdateCheeksDto,
  ): Promise<Partial<{ categoryId: Types.ObjectId }>> {
    if (updateCheeksDto.categoryId) {
      const categoryIdString =
        typeof updateCheeksDto.categoryId === 'string'
          ? updateCheeksDto.categoryId
          : updateCheeksDto.categoryId.toString();
      return { categoryId: await this._prepareCategoryForUpdate(categoryIdString) };
    }
    return {};
  }

  private async _prepareTagsUpdatePayload(
    updateCheeksDto: UpdateCheeksDto,
    currentTagIds: Types.ObjectId[],
  ): Promise<Partial<{ tagIds: Types.ObjectId[] }>> {
    if (updateCheeksDto.hasOwnProperty('tagNames')) {
      const tagUpdateResult = await this._prepareTagsForUpdate(
        currentTagIds,
        updateCheeksDto.tagNames,
      );
      if (tagUpdateResult.tagIdsToSet !== undefined) {
        return { tagIds: tagUpdateResult.tagIdsToSet };
      }
    }
    return {};
  }

  private async _prepareSlugUpdatePayload(
    updateCheeksDto: UpdateCheeksDto,
    currentTitle: string,
    ownerId: string,
    cheekId: string,
  ): Promise<Partial<{ slug: string }>> {
    if (updateCheeksDto.title) {
      const newSlug = await this._prepareSlugForUpdate(
        currentTitle,
        updateCheeksDto.title,
        ownerId,
        cheekId,
      );
      if (newSlug) {
        return { slug: newSlug };
      }
    }
    return {};
  }

  private async _prepareCheekUpdatePayload(
    updateCheeksDto: UpdateCheeksDto,
    currentCheek: CheeksDocument, // Contains current title and raw tagIds (ObjectId[])
    ownerId: string,
  ): Promise<Partial<{ categoryId: Types.ObjectId; tagIds: Types.ObjectId[]; slug: string }>> {
    const categoryPayload = await this._prepareCategoryUpdatePayload(updateCheeksDto);
    const tagsPayload = await this._prepareTagsUpdatePayload(updateCheeksDto, currentCheek.tagIds as Types.ObjectId[]);
    const slugPayload = await this._prepareSlugUpdatePayload(
      updateCheeksDto,
      currentCheek.title,
      ownerId,
      (currentCheek._id as Types.ObjectId).toString(),
    );

    return {
      ...categoryPayload,
      ...tagsPayload,
      ...slugPayload,
    };
  }

  private async _applySaveAndPopulateCheekUpdate(
    cheekToUpdate: CheeksDocument,
    originalUpdateDto: UpdateCheeksDto, // Used for non-specially handled fields
    preparedPayload: Partial<{ categoryId: Types.ObjectId; tagIds: Types.ObjectId[]; slug: string }>,
  ): Promise<CheeksDocument> {
    // Destructure DTO: categoryId and tagNames are specially handled by preparedPayload.
    // Other fields from originalUpdateDto (like title, description, links, isPublic) will be in restOfDto.
    const {
      categoryId: _dtoCategoryId,
      tagNames: _dtoTagNames,
      ...restOfDto
    } = originalUpdateDto;

    Object.assign(cheekToUpdate, restOfDto, preparedPayload);

    try {
      let updatedCheek = await cheekToUpdate.save();
      updatedCheek = await updatedCheek.populate(this.cheekPopulationPaths);
      return updatedCheek;
    } catch (error: any) {
      // this.logger.error(`Error updating cheek ${cheekToUpdate._id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        `Error updating cheek: ${error.message}`,
      );
    }
  }

  private async _prepareCategoryForUpdate(categoryIdDto: string): Promise<Types.ObjectId> {
    await this.categoriesService.findOne(categoryIdDto); // Validates category existence
    return new Types.ObjectId(categoryIdDto);
  }

  private async _prepareTagsForUpdate(
    currentTagIds: Types.ObjectId[],
    tagNamesDto?: string[],
  ): Promise<{ tagIdsToSet?: Types.ObjectId[] }> {
    // Only proceed if tagNamesDto is actually provided in the DTO (even if it's an empty array)
    if (tagNamesDto === undefined) {
      return {}; // No changes to tags intended
    }

    const oldTagIdsStrings = currentTagIds.map(tag => tag.toString());
    const newTagObjects = await this._prepareTagsForCreation(tagNamesDto); // Handles empty tagNamesDto
    const newTagIdsToSet = newTagObjects.map(tag => tag._id);
    const newTagIdsStrings = newTagIdsToSet.map(id => id.toString());

    await this._updateTagUsageCounts(oldTagIdsStrings, newTagIdsStrings);
    return { tagIdsToSet: newTagIdsToSet };
  }

  private async _prepareSlugForUpdate(
    currentTitle: string,
    newTitleDto: string | undefined,
    ownerId: string,
    cheekIdToExclude: string,
  ): Promise<string | undefined> {
    if (newTitleDto && newTitleDto !== currentTitle) {
      return this.generateUniqueSlug(newTitleDto, ownerId, cheekIdToExclude);
    }
    return undefined; // No slug change needed
  }

  // --- Delete Cheek Helpers ---
  private async _deleteAssociatedReviews(cheekId: Types.ObjectId): Promise<void> {
    await this.reviewModel.deleteMany({ cheekId }).exec();
    // this.logger.log(`Deleted reviews for cheek ID: "${cheekId}"`);
  }

  private async _decrementTagCountsForDeletedCheek(tagDocuments: TagDocument[] | Types.ObjectId[]): Promise<void> {
    if (tagDocuments && tagDocuments.length > 0) {
      const tagIdsToDecrement = tagDocuments.map(tag => {
        return (tag instanceof Types.ObjectId ? tag : (tag as TagDocument)._id).toString();
      });
      await this._updateTagUsageCounts(tagIdsToDecrement, []); // New tags are empty as we are deleting
      // this.logger.log(`Updated tag usage counts for deleted cheek.`);
    }
  }

  private async _performCheekDeletion(cheekId: Types.ObjectId): Promise<void> {
    const deletionResult = await this.CheeksModel.findByIdAndDelete(cheekId).exec();
    if (!deletionResult) {
      // this.logger.warn(`Cheek with ID "${cheekId}" was not found during findByIdAndDelete.`);
      throw new NotFoundException(`Cheek with ID "${cheekId}" not found during final delete operation.`);
    }
    // this.logger.log(`Successfully deleted cheek document with ID: "${cheekId}"`);
  }

  private _handleDeleteCheekError(error: any, cheekId: string): never {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    // this.logger.error(`Error during deletion process for cheek ID "${cheekId}": ${error.message}`, error.stack);
    throw new InternalServerErrorException(
      `Could not delete cheek "${cheekId}" due to an internal error.`,
    );
  }
}
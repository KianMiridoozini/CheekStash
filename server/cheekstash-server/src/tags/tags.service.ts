import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tag, TagDocument } from './schema/tag.schema';
import { CreateTagDto } from './dto/create-tag.dto';
// import { UpdateTagDto } from './dto/update-tag.dto'; // If you create an UpdateTagDto

@Injectable()
export class TagsService {
    // private readonly logger = new Logger(TagsService.name);

    constructor(@InjectModel(Tag.name) private tagModel: Model<TagDocument>) { }

    // --- Public Methods: Tag Creation ---

    async create(createTagDto: CreateTagDto): Promise<TagDocument> {
        const normalizedTagName = this._normalizeTagName(createTagDto.name);
        const newTag = new this.tagModel({ name: normalizedTagName });

        try {
            return await newTag.save();
        } catch (error: any) {
            this._handleCreateTagError(error, normalizedTagName);
        }
    }

    async findOrCreateTags(tagNames: string[]): Promise<TagDocument[]> {
        const uniqueNormalizedTagNames = this._prepareTagNamesForFindOrCreate(tagNames);
        const results: TagDocument[] = [];

        for (const name of uniqueNormalizedTagNames) {
            const tag = await this._getOrCreateSingleTag(name);
            results.push(tag);
        }
        return results;
    }

    // --- Public Methods: Tag Retrieval ---

    async findAll(): Promise<TagDocument[]> {
        return this.tagModel.find().sort({ usageCount: -1, name: 1 }).exec();
    }

    async findOne(id: string): Promise<TagDocument> {
        const tag = await this._findTagByIdInternal(id);
        if (!tag) {
            throw new NotFoundException(`Tag with ID "${id}" not found`);
        }
        return tag;
    }

    async findOneByName(name: string): Promise<TagDocument | null> {
        const normalizedName = this._normalizeTagName(name);
        return this.tagModel.findOne({ name: normalizedName }).exec();
    }

    async findByNameRegex(nameRegex: RegExp): Promise<TagDocument[]> {
        // Assuming the regex is constructed to match lowercase names if that's the storage convention
        return this.tagModel.find({ name: nameRegex }).exec();
    }

    async findByIds(ids: string[]): Promise<TagDocument[]> {
        const validIds = ids.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
        if (validIds.length === 0 && ids.length > 0) {
            // this.logger.warn('findByIds called with only invalid IDs');
            return [];
        }
        if (validIds.length !== ids.length) {
            // this.logger.warn('findByIds called with some invalid IDs, filtering them out.');
        }
        return this.tagModel.find({ _id: { $in: validIds } }).exec();
    }

    // --- Public Methods: Tag Modification & Deletion ---

    async updateTagUsageCount(tagId: string, increment: number): Promise<TagDocument | null> {
        if (!Types.ObjectId.isValid(tagId)) {
            // this.logger.warn(`Invalid Tag ID format "${tagId}" for usage count update.`);
            return null; // Or throw BadRequestException
        }
        try {
            return await this.tagModel.findByIdAndUpdate(
                tagId,
                { $inc: { usageCount: increment } },
                { new: true },
            ).exec();
        } catch (error: any) {
            // this.logger.error(`Failed to update usage count for tag ${tagId}: ${error.message}`, error.stack);
            throw new InternalServerErrorException(`Failed to update usage count for tag ${tagId}`);
        }
    }

    async remove(id: string): Promise<{ message: string }> {
        const tagToDelete = await this.findOne(id); // Ensures tag exists and throws NotFound if not

        const result = await this.tagModel.findByIdAndDelete(id).exec();
        // This check is somewhat redundant due to findOne above, but good for atomicity assurance
        if (!result) {
            // this.logger.warn(`Tag with ID "${id}" was found by findOne but not by findByIdAndDelete.`);
            throw new NotFoundException(`Tag with ID "${id}" could not be deleted, possibly removed by another process.`);
        }
        return { message: `Tag "${tagToDelete.name}" deleted successfully` };
    }

    // --- Private Helper Methods ---

    private _normalizeTagName(name: string): string {
        return name.toLowerCase().trim();
    }

    private _validateTagId(id: string): void {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException(`Invalid Tag ID format "${id}"`);
        }
    }

    private async _findTagByIdInternal(id: string): Promise<TagDocument | null> {
        this._validateTagId(id); // Throws if invalid
        return this.tagModel.findById(id).exec();
    }

    private _handleCreateTagError(error: any, tagName: string): never {
        if (error.code === 11000) { // MongoDB duplicate key error
            throw new ConflictException(`Tag "${tagName}" already exists`);
        }
        // this.logger.error(`Error creating tag "${tagName}": ${error.message}`, error.stack);
        throw new InternalServerErrorException(`Error creating tag "${tagName}": ${error.message}`);
    }

    private _prepareTagNamesForFindOrCreate(tagNames: string[]): string[] {
        return [...new Set(tagNames.map(name => this._normalizeTagName(name)).filter(Boolean))];
    }

    private async _getOrCreateSingleTag(normalizedName: string): Promise<TagDocument> {
        let tag = await this.findOneByName(normalizedName); // Uses normalized name
        if (!tag) {
            try {
                // `create` method already handles normalization and specific error handling
                tag = await this.create({ name: normalizedName });
            } catch (error: any) {
                // If it's a conflict, another process might have created it. Try finding it again.
                if (error instanceof ConflictException) {
                    // this.logger.log(`Conflict creating tag "${normalizedName}", attempting to re-fetch.`);
                    tag = await this.findOneByName(normalizedName);
                    if (!tag) {
                        // this.logger.error(`Could not find tag "${normalizedName}" after conflict and re-fetch.`);
                        throw new InternalServerErrorException(
                            `Critical error: Could not create or find tag "${normalizedName}" after conflict.`,
                        );
                    }
                } else {
                    // this.logger.error(`Unexpected error in _getOrCreateSingleTag for "${normalizedName}": ${error.message}`, error.stack);
                    throw error; // Re-throw other errors (e.g., InternalServerErrorException from create)
                }
            }
        }
        return tag;
    }
}
import { Injectable, NotFoundException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tag, TagDocument } from './schema/tag.schema';
import { CreateTagDto } from './dto/create-tag.dto';
// import { UpdateTagDto } from './dto/update-tag.dto'; // If you create an UpdateTagDto

@Injectable()
export class TagsService {
    constructor(@InjectModel(Tag.name) private tagModel: Model<TagDocument>) { }

    async create(createTagDto: CreateTagDto): Promise<TagDocument> {
        // Name is already transformed to lowercase by schema, but good to ensure consistency if used elsewhere
        const tagName = createTagDto.name.toLowerCase().trim();
        try {
            const newTag = new this.tagModel({ name: tagName });
            return await newTag.save();
        } catch (error) {
            if (error.code === 11000) {
                throw new ConflictException(`Tag "${tagName}" already exists`);
            }
            throw new InternalServerErrorException('Error creating tag');
        }
    }

    async findAll(): Promise<TagDocument[]> {
        return this.tagModel.find().sort({ usageCount: -1, name: 1 }).exec(); // Sort by usage, then name
    }

    async findOne(id: string): Promise<TagDocument> {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException(`Invalid Tag ID format "${id}"`);
        }
        const tag = await this.tagModel.findById(id).exec();
        if (!tag) {
            throw new NotFoundException(`Tag with ID "${id}" not found`);
        }
        return tag;
    }

    async findOneByName(name: string): Promise<TagDocument | null> {
        return this.tagModel.findOne({ name: name.toLowerCase().trim() }).exec();
    }

    async findByNameRegex(nameRegex: RegExp): Promise<TagDocument[]> {
        return this.tagModel.find({ name: nameRegex }).exec();
    }

    async findByIds(ids: string[]): Promise<TagDocument[]> {
        return this.tagModel.find({ _id: { $in: ids } }).exec();
    }

    async findOrCreateTags(tagNames: string[]): Promise<TagDocument[]> {
        const uniqueTagNames = [...new Set(tagNames.map(name => name.toLowerCase().trim()))];
        const results: TagDocument[] = [];

        for (const name of uniqueTagNames) {
            if (!name) continue; // Skip empty tag names
            let tag = await this.findOneByName(name);
            if (!tag) {
                try {
                    tag = await this.create({ name });
                } catch (error) {
                    // If it's a conflict, another process might have created it. Try finding it again.
                    if (error instanceof ConflictException) {
                        tag = await this.findOneByName(name);
                        if (!tag) {
                            throw new InternalServerErrorException(`Could not create or find tag "${name}" after conflict.`);
                        }
                    } else {
                        throw error;
                    }
                }
            }
            results.push(tag);
        }
        return results;
    }

    async updateTagUsageCount(tagId: string, increment: number): Promise<TagDocument | null> {
        if (!Types.ObjectId.isValid(tagId)) {
            //console.warn(`Invalid Tag ID format "${tagId}" for usage count update.`);
            return null;
        }
        return this.tagModel.findByIdAndUpdate(
            tagId,
            { $inc: { usageCount: increment } },
            { new: true },
        ).exec();
    }

    async remove(id: string): Promise<{ message: string }> {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException(`Invalid Tag ID format "${id}"`);
        }
        const tag = await this.findOne(id); 
        const result = await this.tagModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new NotFoundException(`Tag with ID "${id}" not found for deletion.`);
        }
        return { message: `Tag "${tag.name}" deleted successfully` };
    }
}

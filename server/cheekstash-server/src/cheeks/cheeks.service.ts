import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cheeks, CheeksDocument } from './schemas/cheek.schema';
import { CheeksDto } from './dto/cheeks.dto';
import { UpdateCheeksDto } from './dto/update-cheeks.dto';
import { CategoriesService } from '../categories/categories.service'; 
import { TagsService } from '../tags/tags.service'; 

@Injectable()
export class CheeksService {
  constructor(
    @InjectModel(Cheeks.name)
    private CheeksModel: Model<CheeksDocument>,
    private readonly categoriesService: CategoriesService, 
    private readonly tagsService: TagsService, 
  ) {}

  /**
   * Create a new Cheeks
   */
  async createCheeks(
    cheeksDto: CheeksDto,
    ownerId: string,
  ): Promise<CheeksDocument> {
    // 1. Validate categoryId
    await this.categoriesService.findOne(cheeksDto.categoryId); // Throws NotFoundException if not found

    // 2. Process tagNames
    let tagIds: Types.ObjectId[] = [];
    if (cheeksDto.tagNames && cheeksDto.tagNames.length > 0) {
      const tagDocuments = await this.tagsService.findOrCreateTags(cheeksDto.tagNames);
      tagIds = tagDocuments.map(tag => tag._id as Types.ObjectId); // Assert type here
      // Increment usage count for each tag
      for (const tag of tagDocuments) {
        await this.tagsService.updateTagUsageCount((tag._id as Types.ObjectId).toString(), 1); // Assert type here
      }
    }

    const newCheeks = new this.CheeksModel({
      ...cheeksDto,
      tagIds: tagIds, 
      owner: ownerId,
    });
    
    try {
      const savedCheek = await newCheeks.save();
      return savedCheek.populate([
        { path: 'categoryId' },
        { path: 'tagIds' },
      ]);
    } catch (error) {
      throw new InternalServerErrorException('Error saving new Cheeks: ' + error.message);
    }
  }

  /**
   * Get All Cheekss
   */
  async getCheeks(): Promise<CheeksDocument[]> {
    return this.CheeksModel.find()
      .populate('categoryId')
      .populate('tagIds')
      .exec();
  }

  /**
   * Get a Cheeks by ID
   */
  async getCheeksById(id: string): Promise<CheeksDocument> {
    const cheek = await this.CheeksModel.findById(id)
      .populate('categoryId')
      .populate('tagIds')
      .exec();
    if (!cheek) {
      throw new NotFoundException('Cheeks not found');
    }
    return cheek;
  }

  /**
   * Update a Cheeks
   */
  async updateCheeks(
    id: string,
    updateDto: UpdateCheeksDto,
    userId: string,
  ): Promise<CheeksDocument> {
    const originalCheek = await this.CheeksModel.findById(id);
    if (!originalCheek) {
      throw new NotFoundException('Cheeks not found');
    }
    if (originalCheek.owner.toString() !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this Cheeks',
      );
    }

    // 1. Validate categoryId if it's being updated
    if (updateDto.categoryId && updateDto.categoryId !== originalCheek.categoryId.toString()) {
      await this.categoriesService.findOne(updateDto.categoryId); // Throws if not found
    }

    // 2. Handle tag updates
    const originalTagIds = originalCheek.tagIds.map(tagId => tagId.toString());
    let finalTagIds: Types.ObjectId[] | undefined = undefined; // Use undefined to signify no change unless DTO specifies

    if (updateDto.tagNames !== undefined) { // Check if tagNames is explicitly provided (even if empty array)
      const newTagDocuments = await this.tagsService.findOrCreateTags(updateDto.tagNames || []);
      const newTagIds = newTagDocuments.map(tag => (tag._id as Types.ObjectId).toString()); // Assert type here
      finalTagIds = newTagDocuments.map(tag => tag._id as Types.ObjectId); // Assert type here

      const tagsToAdd = newTagIds.filter(tagId => !originalTagIds.includes(tagId));
      const tagsToRemove = originalTagIds.filter(tagId => !newTagIds.includes(tagId));

      for (const tagId of tagsToAdd) {
        await this.tagsService.updateTagUsageCount(tagId, 1);
      }
      for (const tagId of tagsToRemove) {
        await this.tagsService.updateTagUsageCount(tagId, -1);
      }
    }
    
    // Prepare the update payload
    // Explicitly remove tagNames from updateDto as we are handling it via tagIds
    const { tagNames, ...restOfUpdateDto } = updateDto;
    const updatePayload: any = { ...restOfUpdateDto };
    if (finalTagIds !== undefined) {
      updatePayload.tagIds = finalTagIds;
    }


    const updatedCheek = await this.CheeksModel.findOneAndUpdate(
      { _id: id, owner: userId },
      updatePayload,
      { new: true, runValidators: true },
    );

    if (!updatedCheek) {
      throw new NotFoundException(
        'Cheeks not found or update failed post-authorization',
      );
    }

    return updatedCheek.populate([
      { path: 'categoryId' },
      { path: 'tagIds' },
    ]);
  }

  /**
   * Delete a Cheeks
   */
  async deleteCheeks(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    const cheek = await this.CheeksModel.findById(id);
    if (!cheek) {
      throw new NotFoundException('Cheeks not found');
    }
    if (cheek.owner.toString() !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this Cheeks',
      );
    }

    if (cheek.tagIds && cheek.tagIds.length > 0) {
      for (const tagId of cheek.tagIds) {
        await this.tagsService.updateTagUsageCount(tagId.toString(), -1);
      }
    }

    await this.CheeksModel.findByIdAndDelete(id);
    return { message: 'Cheeks deleted successfully' };
  }
}

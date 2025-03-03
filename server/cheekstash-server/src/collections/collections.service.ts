import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Collection, CollectionDocument } from './schemas/collection.schema';
import { CollectionDto } from './dto/collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(Collection.name)
    private collectionModel: Model<CollectionDocument>,
  ) {}

  /**
   * Create a new collection
   */
  async createCollection(
    collectionDto: CollectionDto,
    ownerId: string,
  ): Promise<CollectionDocument> {
    const newCollection = new this.collectionModel({
      ...collectionDto,
      owner: ownerId,
    });
    return newCollection.save();
  }

  /**
   * Get All collections
   */
  async getCollections(): Promise<CollectionDocument[]> {
    return this.collectionModel.find().exec();
  }

  /**
   * Get a collection by ID
   */
  async getCollectionById(id: string): Promise<CollectionDocument> {
    const collection = await this.collectionModel.findById(id).exec();
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    return collection;
  }

  /**
   * Update a collection
   */
  async updateCollection(
    id: string,
    updateDto: Partial<CollectionDto>,
    userId: string,
  ): Promise<CollectionDocument> {
    const collection = await this.collectionModel.findById(id);
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    if (collection.owner.toString() !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this collection',
      );
    }

    /**
     * Update the collection with the provided data
     */
    const updated = await this.collectionModel.findOneAndUpdate(
      { _id: id, owner: userId },
      updateDto,
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new NotFoundException(
        'Collection not found or you are not allowed to update it',
      );
    }
    return updated;
  }

  /**
   * Delete a collection
   */
  async deleteCollection(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    // First, retrieve the collection by ID
    const collection = await this.collectionModel.findById(id);
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    // Check if the collection's owner matches the requesting user's ID
    if (collection.owner.toString() !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this collection',
      );
    }

    // If the check passes, delete the collection
    await this.collectionModel.findByIdAndDelete(id);
    return { message: 'Collection deleted successfully' };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Collection, CollectionDocument } from './schemas/collection.schema';
import { CreateCollectionDto } from './dto/create-collection.dto';

@Injectable()
export class CollectionsService {
  constructor(
    @InjectModel(Collection.name) private collectionModel: Model<CollectionDocument>,
  ) {}

  async create(createCollectionDto: CreateCollectionDto, ownerId: string): Promise<Collection> {
    const createdCollection = new this.collectionModel({
      ...createCollectionDto,
      owner: ownerId,
    });
    return createdCollection.save();
  }

  // Other CRUD methods (findAll, findOne, update, remove) will be added.
}

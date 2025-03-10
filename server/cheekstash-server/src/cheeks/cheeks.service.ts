import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cheeks, CheeksDocument } from './schemas/cheeks.schema';
import { CheeksDto } from './dto/cheeks.dto';
import { UpdateCheeksDto } from './dto/update-cheeks.dto';

@Injectable()
export class CheeksService {
  constructor(
    @InjectModel(Cheeks.name)
    private CheeksModel: Model<CheeksDocument>,
  ) {}

  /**
   * Create a new Cheeks
   */
  async createCheeks(
    CheeksDto: CheeksDto,
    ownerId: string,
  ): Promise<CheeksDocument> {
    const newCheeks = new this.CheeksModel({
      ...CheeksDto,
      owner: ownerId,
    });
    return newCheeks.save();
  }

  /**
   * Get All Cheekss
   */
  async getCheeks(): Promise<CheeksDocument[]> {
    return this.CheeksModel.find().exec();
  }

  /**
   * Get a Cheeks by ID
   */
  async getCheeksById(id: string): Promise<CheeksDocument> {
    const Cheeks = await this.CheeksModel.findById(id).exec();
    if (!Cheeks) {
      throw new NotFoundException('Cheeks not found');
    }
    return Cheeks;
  }

  /**
   * Update a Cheeks
   */
  async updateCheeks(
    id: string,
    updateDto: Partial<CheeksDto>,
    userId: string,
  ): Promise<CheeksDocument> {
    const Cheeks = await this.CheeksModel.findById(id);
    if (!Cheeks) {
      throw new NotFoundException('Cheeks not found');
    }
    if (Cheeks.owner.toString() !== userId) {
      throw new ForbiddenException(
        'You are not allowed to update this Cheeks',
      );
    }

    /**
     * Update the Cheeks with the provided data
     */
    const updated = await this.CheeksModel.findOneAndUpdate(
      { _id: id, owner: userId },
      updateDto,
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new NotFoundException(
        'Cheeks not found or you are not allowed to update it',
      );
    }
    return updated;
  }

  /**
   * Delete a Cheeks
   */
  async deleteCheeks(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    // First, retrieve the Cheeks by ID
    const Cheeks = await this.CheeksModel.findById(id);
    if (!Cheeks) {
      throw new NotFoundException('Cheeks not found');
    }
    // Check if the Cheeks's owner matches the requesting user's ID
    if (Cheeks.owner.toString() !== userId) {
      throw new ForbiddenException(
        'You are not allowed to delete this Cheeks',
      );
    }

    // If the check passes, delete the Cheeks
    await this.CheeksModel.findByIdAndDelete(id);
    return { message: 'Cheeks deleted successfully' };
  }
}

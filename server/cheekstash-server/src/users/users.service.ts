import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Collection, CollectionDocument } from '../collections/schemas/collection.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Collection.name) private collectionModel: Model<CollectionDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
  ) {}

  /**
   * Create a new user account.
   */
  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const { username, email, password } = createUserDto;
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      throw new BadRequestException('Email or username already taken');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new this.userModel({
      username,
      email,
      passwordHash: hashedPassword,
    });
    return newUser.save();
  }

  /**
   * List all users.
   */
  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().select('-passwordHash').exec();
  }

  /**
   * Find a user by ID.
   */
  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('-passwordHash').exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Find a user by email.
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('-passwordHash').exec();
  }

  /**
   * Search users by name (or part of name)
   */
  async searchByName(name: string): Promise<UserDocument[]> {
    try {
      const users = await this.userModel.find({
        $or: [
          { username: { $regex: name, $options: 'i' } },
          { 'profile.displayName': { $regex: name, $options: 'i' } },
        ],
      }).select('-passwordHash').exec();
  
      if (!users || users.length === 0) {
        throw new NotFoundException('No users found with the given name');
      }
  
      return users;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('An error occurred while searching for users');
    }
  }

  /**
   * Find users by minimum collection count.
   */
  async findByCollectionCount(min: number): Promise<UserDocument[]> {
    const aggregationResult = await this.collectionModel.aggregate([
      { $group: { _id: '$owner', count: { $sum: 1 } } },
      { $match: { count: { $gte: min } } },
    ]);
    const userIds = aggregationResult.map((result) => result._id);
    return this.userModel.find({ _id: { $in: userIds } }).select('-passwordHash').exec();
  }

  /**
   * Update user profile.
   * Only the user themselves or an admin can update.
   * Note: Schema nests profile data.
   */
  async updateProfile(
    targetUserId: string,
    updateUserDto: UpdateUserDto,
    requester: { id: string; role: string },
  ): Promise<UserDocument> {
    if (targetUserId !== requester.id && requester.role !== 'admin') {
      throw new UnauthorizedException('You are not allowed to update this profile');
    }
    // Construct update object using dot notation for nested profile fields
    const updateData: any = {};
    if (updateUserDto.displayName !== undefined) {
      updateData['profile.displayName'] = updateUserDto.displayName;
    }
    if (updateUserDto.bio !== undefined) {
      updateData['profile.bio'] = updateUserDto.bio;
    }
    if (updateUserDto.avatarUrl !== undefined) {
      updateData['profile.avatarUrl'] = updateUserDto.avatarUrl;
    }
    // Optionally, update other fields if necessary

    const updatedUser = await this.userModel.findByIdAndUpdate(
      targetUserId,
      { $set: updateData },
      { new: true, runValidators: true },
    );
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    return updatedUser;
  }


  /**
   * Change user password.
   * Requires the user to provide the old password for verification.
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { oldPassword, newPassword } = changePasswordDto;
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Incorrect old password');
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    return { message: 'Password updated successfully' };
  }

  /**
   * Delete user account.
   * Only the user themselves or an admin can delete the account.
   * Password confirmation is required.
   */
  async deleteUser(
    targetUserId: string,
    confirmPassword: string,
    requester: { id: string; role: string },
  ): Promise<{ message: string }> {
    if (targetUserId !== requester.id && requester.role !== 'admin') {
      throw new UnauthorizedException('You are not allowed to delete this account');
    }
    const user = await this.userModel.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isValid = await bcrypt.compare(confirmPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Password confirmation failed');
    }
    // Cascade delete associated collections and reviews
    await this.collectionModel.deleteMany({ owner: targetUserId });
    await this.reviewModel.deleteMany({ userId: targetUserId });
    await this.userModel.findByIdAndDelete(targetUserId);
    return { message: 'User and all associated collections and reviews have been deleted' };
  }
}

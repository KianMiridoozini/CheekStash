import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto'; // This DTO is now assumed to NOT contain avatarUrl/profileImagePublicId
import { ChangePasswordDto } from './dto/change-password.dto';
import { Cheeks, CheeksDocument } from '../cheeks/schemas/cheek.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';
import { CloudinaryService } from '../common/cloudinary.service';
import { File } from 'multer'; // Assuming Express.Multer.File or equivalent
import { assertUserFound } from '../common/guards/user-check.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Cheeks.name) private cheekModel: Model<CheeksDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  // --- Private Helper Methods (UNCHANGED) ---

  private _sanitizeUsername(username: string): string {
    if (!username) return '';
    return username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private _escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async _deleteOldCloudinaryImage(publicId?: string): Promise<void> {
    if (publicId) {
      try {
        await this.cloudinaryService.deleteImage(publicId);
      } catch (error) {
        console.error(
          `Failed to delete old image ${publicId} from Cloudinary:`,
          error,
        );
        // Consider if you need to re-throw or handle this error more explicitly
      }
    }
  }

  private _toUserObject(userDoc: UserDocument | null): any { // Added | null to match usage
    if (!userDoc) {
      return null;
    }

    // Assuming userDoc.toObject() and your schema's toJSON transform handle this correctly
    const userObject = userDoc.toObject
      ? userDoc.toObject({ virtuals: true, getters: true })
      : { ...userDoc };
    return userObject;
  }

  // --- User Account Creation & Authentication Related Methods (UNCHANGED) ---

  async create(createUserDto: CreateUserDto): Promise<Omit<UserDocument, 'passwordHash'>> {
    const { email, password } = createUserDto;
    const sanitizedUsername = this._sanitizeUsername(createUserDto.username);
    const normalizedEmail = email.toLowerCase().trim();

    if (!sanitizedUsername) {
      throw new BadRequestException(
        'Username is invalid or became empty after sanitization. Please use alphanumeric characters, spaces, or hyphens.',
      );
    }

    const existingUser = await this.userModel.findOne({
      $or: [{ email: normalizedEmail }, { username: sanitizedUsername }],
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        throw new BadRequestException('Email already taken.');
      }
      if (existingUser.username === sanitizedUsername) {
        throw new BadRequestException(
          'Username already taken. Please try a different one.',
        );
      }
      throw new BadRequestException('Email or username conflict.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new this.userModel({
      username: sanitizedUsername,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      profile: {},
    });

    const savedUser = await newUser.save();
    return this._toUserObject(savedUser);
  }

  async findByEmail(
    email: string,
    includePasswordHash = false,
  ): Promise<UserDocument | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const query = this.userModel.findOne({ email: normalizedEmail });
    if (includePasswordHash) {
      query.select('+passwordHash');
    } else {
      query.select('-passwordHash -__v'); // Keep this if _toUserObject doesn't reliably remove them
    }
    return query.exec();
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this.userModel.findById(userId).select('+passwordHash').exec();
    assertUserFound(user);

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Incorrect old password.');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return { message: 'Password updated successfully.' };
  }

  // --- User Query Methods ---

  async findAll(): Promise<Omit<UserDocument, 'passwordHash'>[]> {
    const users = await this.userModel.find().select('-passwordHash -__v').exec();
    return users.map(user => this._toUserObject(user));
  }

  async findById(id: string): Promise<Omit<UserDocument, 'passwordHash'>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const user = await this.userModel.findById(id).select('-passwordHash -__v').exec();
    assertUserFound(user);
    return this._toUserObject(user!); // user! because assertUserFound guarantees it's not null
  }

  async findUserByUsername(username: string): Promise<Omit<UserDocument, 'passwordHash'> | null> {
    const sanitizedUsername = this._sanitizeUsername(username);
    if (!sanitizedUsername) {
      return null;
    }
    const user = await this.userModel
      .findOne({ username: sanitizedUsername })
      .select('-passwordHash -__v')
      .exec();
    return user ? this._toUserObject(user) : null;
  }

  async searchByName(nameQuery: string): Promise<Omit<UserDocument, 'passwordHash'>[]> { // Changed return type
    const searchTerm = nameQuery.trim();
    if (!searchTerm) {
      return [];
    }

    const escapedSearchTerm = this._escapeRegex(searchTerm);
    const displayNameRegex = new RegExp(escapedSearchTerm, 'i');
    const sanitizedUsernameQuery = this._sanitizeUsername(searchTerm);
    const usernameRegex = new RegExp(this._escapeRegex(sanitizedUsernameQuery), 'i');

    const users = await this.userModel
      .find({
        $or: [
          { username: usernameRegex },
          { 'profile.displayName': displayNameRegex },
        ],
      })
      .select('-passwordHash -__v')
      .limit(20)
      .exec();
    return users.map(user => this._toUserObject(user));
  }

  async findByCheekCount(min: number): Promise<Omit<UserDocument, 'passwordHash'>[]> { // Changed return type
    if (isNaN(min) || min < 0) {
      throw new BadRequestException('Minimum cheek count must be a non-negative number.');
    }

    // This aggregate already projects out passwordHash and __v
    const usersWithCheekCount = await this.cheekModel.aggregate([
      { $group: { _id: '$owner', cheekCount: { $sum: 1 } } },
      { $match: { cheekCount: { $gte: min } } },
      {
        $lookup: {
          from: this.userModel.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
          pipeline: [{ $project: { passwordHash: 0, __v: 0 } }], // Ensures sensitive data is not included
        },
      },
      { $unwind: '$userDetails' },
      { $replaceRoot: { newRoot: '$userDetails' } },
    ]);

    return usersWithCheekCount.filter(user => user) as Omit<UserDocument, 'passwordHash'>[];
  }

  // --- User Profile & Account Management Methods ---

  /**
   * Updates basic profile information (e.g., displayName, bio).
   * Avatar management is handled by uploadProfileImage and deleteAvatar methods.
   * Assumes UpdateUserDto does NOT contain avatarUrl or profileImagePublicId.
   */
  async updateProfile(
    targetUserId: string,
    updateUserDto: UpdateUserDto, // This DTO should only contain fields like displayName, bio
    requester: { id: string; role: string },
  ): Promise<Omit<UserDocument, 'passwordHash'>> { // Changed return type
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid target user ID format.');
    }

    const user = await this.userModel.findById(targetUserId).exec();
    assertUserFound(user);

    if (targetUserId !== requester.id && requester.role !== 'admin') {
      throw new ForbiddenException('You are not authorized to update this profile.');
    }

    user.profile = user.profile || {}; // Ensure profile object exists

    let profileChanged = false;
    // Update displayName if provided
    if (updateUserDto.displayName !== undefined) {
      const newDisplayName = updateUserDto.displayName.trim() === '' ? undefined : updateUserDto.displayName.trim();
      if (user.profile.displayName !== newDisplayName) {
        user.profile.displayName = newDisplayName;
        profileChanged = true;
      }
    }

    // Update bio if provided
    if (updateUserDto.bio !== undefined) {
      const newBio = updateUserDto.bio.trim() === '' ? undefined : updateUserDto.bio.trim();
      if (user.profile.bio !== newBio) {
        user.profile.bio = newBio;
        profileChanged = true;
      }
    }

    // Avatar-related logic is REMOVED from this method.
    
    if (profileChanged) {
      user.markModified('profile'); // Explicitly mark the 'profile' path as modified
      const updatedUser = await user.save();
      return this._toUserObject(updatedUser);
    } else {
      // If no actual changes were made to the profile fields,
      // just return the current user state without saving.
      return this._toUserObject(user); 
    }
  }

  /**
   * Uploads or replaces a user's profile image.
   * This method remains largely the same but now works in conjunction with a separate deleteAvatar.
   */
  async uploadProfileImage(
    userId: string, // Restored userId parameter name
    file: File, 
    // requester: { id: string; role: string }, 
  ): Promise<Omit<UserDocument, 'passwordHash'>> { 
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const user = await this.userModel.findById(userId).exec();
    assertUserFound(user);

    if (!file) {
      throw new BadRequestException('No file provided for avatar upload.');
    }

    user.profile = user.profile || {};

    if (user.profile.profileImagePublicId) {
      await this._deleteOldCloudinaryImage(user.profile.profileImagePublicId);
    }

    let uploadResult;
    try {
      uploadResult = await this.cloudinaryService.uploadImage(file);
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      throw new InternalServerErrorException(
        'Profile image upload to Cloudinary failed.',
      );
    }

    if (!uploadResult || !uploadResult.secure_url || !uploadResult.public_id) {
      throw new InternalServerErrorException(
        'Profile image upload failed: Cloudinary did not return expected details.',
      );
    }

    user.profile.avatarUrl = uploadResult.secure_url;
    user.profile.profileImagePublicId = uploadResult.public_id;

    user.markModified('profile'); // Explicitly mark the 'profile' path as modified
    const updatedUser = await user.save();
    return this._toUserObject(updatedUser);
  }

  /**
   * Deletes a user's profile image.
   */
  async deleteAvatar(
    userId: string, // Restored userId parameter name
    requester: { id: string; role: string },
  ): Promise<Omit<UserDocument, 'passwordHash'>> { 
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const user = await this.userModel.findById(userId).exec();
    assertUserFound(user);

    if (userId !== requester.id && requester.role !== 'admin') {
      throw new ForbiddenException('You are not authorized to delete this avatar.');
    }

    user.profile = user.profile || {};

    if (user.profile.profileImagePublicId) {
      await this._deleteOldCloudinaryImage(user.profile.profileImagePublicId);
      user.profile.avatarUrl = undefined; 
      user.profile.profileImagePublicId = undefined; 
      user.markModified('profile'); // Explicitly mark the 'profile' path as modified
    } else {
      console.log(`User ${userId} has no avatar to delete.`);
    }

    const updatedUser = await user.save();
    return this._toUserObject(updatedUser);
  }
  async updateUserRole(
  targetUserId: string,
  newRole: 'user' | 'admin',
  // Requester details are implicitly handled by the RolesGuard in the controller
): Promise<Omit<UserDocument, 'passwordHash'>> {
  if (!Types.ObjectId.isValid(targetUserId)) {
    throw new BadRequestException('Invalid target user ID format.');
  }
  const user = await this.userModel.findById(targetUserId).exec();
  assertUserFound(user); // Your existing utility to throw NotFoundException if null

  if (user.role === newRole) {
    // Optional: throw BadRequest or simply return user if role is already set
    // console.log(`User ${targetUserId} already has role ${newRole}.`);
    // return this._toUserObject(user);
    throw new BadRequestException(`User already has the role '${newRole}'.`);
  }

  user.role = newRole;
  const updatedUser = await user.save();
  return this._toUserObject(updatedUser);
}


  // --- deleteUser method ---
  async deleteUser(
    targetUserId: string,
    confirmPassword: string,
    requester: { id: string; role: string },
  ): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid target user ID format.');
    }

    if (targetUserId !== requester.id && requester.role !== 'admin') {
      throw new ForbiddenException('You are not authorized to delete this account.');
    }

    const user = await this.userModel.findById(targetUserId).select('+passwordHash').exec();
    assertUserFound(user);

    // If user is deleting their own account, or if your policy requires password for admin deletion
    if (targetUserId === requester.id) { // Simplified: only ask for password if self-deleting
      if (!confirmPassword) {
        throw new BadRequestException('Password confirmation is required to delete your own account.');
      }
      const isPasswordConfirmed = await bcrypt.compare(confirmPassword, user.passwordHash);
      if (!isPasswordConfirmed) {
        throw new UnauthorizedException('Password confirmation failed.');
      }
    }

    await this.cheekModel.deleteMany({ owner: user._id });
    await this.reviewModel.deleteMany({ userId: user._id }); // Ensure 'userId' is the correct field in Review schema
    if (user.profile?.profileImagePublicId) {
      await this._deleteOldCloudinaryImage(user.profile.profileImagePublicId);
    }

    await this.userModel.findByIdAndDelete(user._id);

    return {
      message: 'User and all associated data (cheeks, reviews, avatar) have been deleted.',
    };
  }
}
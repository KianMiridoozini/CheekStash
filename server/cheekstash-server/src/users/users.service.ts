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
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Cheeks, CheeksDocument } from '../cheeks/schemas/cheek.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';
import { CloudinaryService } from '../common/cloudinary.service';
import { File } from 'multer';
import { assertUserFound } from '../common/guards/user-check.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Cheeks.name) private cheekModel: Model<CheeksDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // --- Public Methods: User Account Creation & Authentication ---

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const { password } = createUserDto;
    const { sanitizedUsername, normalizedEmail } = this._validateAndPrepareInitialUserData(createUserDto);

    await this._ensureUserDoesNotExist(sanitizedUsername, normalizedEmail);

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new this.userModel({
      username: sanitizedUsername,
      email: normalizedEmail,
      passwordHash: hashedPassword,
      profile: {}, // Initialize profile object
    });

    const savedUser = await newUser.save();
    return this._toUserObject(savedUser, true)!;
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
      query.select('-passwordHash -__v');
    }
    return query.exec();
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { oldPassword, newPassword } = changePasswordDto;

    const user = await this._findUserForPasswordChange(userId);
    await this._validateOldPassword(oldPassword, user.passwordHash!);

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return { message: 'Password updated successfully.' };
  }

  // --- Public Methods: User Query ---

  async findAll(): Promise<Omit<UserDocument, 'passwordHash'>[]> {
    const users = await this.userModel.find().select('-passwordHash -__v').exec();
    return users.map(user => this._toUserObject(user)!);
  }

  async findById(id: string): Promise<Omit<UserDocument, 'passwordHash'>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const user = await this.userModel.findById(id).select('-passwordHash -__v').exec();
    assertUserFound(user);
    return this._toUserObject(user!)!;
  }

  async findUserByUsername(username: string): Promise<Omit<UserDocument, 'passwordHash'> | null> {
    const sanitizedUsername = this._sanitizeUsername(username);
    if (!sanitizedUsername) {
      return null;
    }
    const userDoc = await this.userModel
      .findOne({ username: sanitizedUsername })
      .select('-passwordHash -__v')
      .exec();
    return userDoc ? this._toUserObject(userDoc) : null;
  }

  async searchByName(nameQuery: string): Promise<Omit<UserDocument, 'passwordHash'>[]> {
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
    return users.map(user => this._toUserObject(user)!);
  }

  async findByCheekCount(min: number): Promise<Omit<UserDocument, 'passwordHash'>[]> {
    if (isNaN(min) || min < 0) {
      throw new BadRequestException('Minimum cheek count must be a non-negative number.');
    }

    const usersWithCheekCount = await this.cheekModel.aggregate([
      { $group: { _id: '$owner', cheekCount: { $sum: 1 } } },
      { $match: { cheekCount: { $gte: min } } },
      {
        $lookup: {
          from: this.userModel.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
          pipeline: [{ $project: { passwordHash: 0, __v: 0 } }],
        },
      },
      { $unwind: '$userDetails' },
      { $replaceRoot: { newRoot: '$userDetails' } },
    ]);

    return usersWithCheekCount.filter(user => !!user) as Omit<UserDocument, 'passwordHash'>[];
  }

  // --- Public Methods: User Profile & Account Management ---

  async updateProfile(
    targetUserId: string,
    updateUserDto: UpdateUserDto,
    requester: { id: string; role: string },
  ): Promise<Omit<UserDocument, 'passwordHash'>> {
    const user = await this._validateAndAuthorizeProfileUpdate(targetUserId, requester);
    const profileChanged = await this._applyProfileDataUpdates(user, updateUserDto);

    if (profileChanged) {
      user.markModified('profile');
      const updatedUser = await user.save();
      return this._toUserObject(updatedUser)!;
    } else {
      return this._toUserObject(user)!;
    }
  }

  async uploadProfileImage(
    userId: string,
    file: File,
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

    const { secure_url, public_id } = await this._handleCloudinaryUpload(file, user.profile.profileImagePublicId);

    user.profile.avatarUrl = secure_url;
    user.profile.profileImagePublicId = public_id;

    user.markModified('profile');
    const updatedUser = await user.save();
    return this._toUserObject(updatedUser)!;
  }

  async deleteAvatar(
    userId: string,
    requester: { id: string; role: string },
  ): Promise<Omit<UserDocument, 'passwordHash'>> {
    if (userId !== requester.id && requester.role !== 'admin') {
      throw new ForbiddenException(
        'You are not authorized to delete this profile image.',
      );
    }

    const user = await this._findUserAndValidateProfileImage(userId);

    if (!user.profile?.profileImagePublicId) {
      throw new InternalServerErrorException(
        'Profile image public ID missing after validation.',
      );
    }

    await this._deleteOldCloudinaryImage(user.profile.profileImagePublicId);
    this._clearUserProfileImageDetails(user);

    const updatedUser = await user.save();
    return this._toUserObject(updatedUser)!;
  }

  async updateUserRole(
    targetUserId: string,
    newRole: 'user' | 'admin',
    requester: { id: string; role: string },
  ): Promise<Omit<UserDocument, 'passwordHash'>> {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid target user ID format.');
    }

    if (requester.id === targetUserId) {
      throw new BadRequestException('Admins cannot change their own role using this endpoint.');
    }

    const user = await this.userModel.findById(targetUserId).exec();
    assertUserFound(user);

    if (user.role === newRole) {
      throw new BadRequestException(`User already has the role '${newRole}'.`);
    }

    user.role = newRole;
    const updatedUser = await user.save();
    return this._toUserObject(updatedUser)!;
  }

  async deleteUser(
    targetUserId: string,
    confirmPassword: string, 
    requester: { id: string; role: string },
  ): Promise<{ message: string }> {
    const user = await this._findUserForDeletion(targetUserId, requester);

    if (targetUserId === requester.id) {
      await this._confirmPasswordForDeletion(user, confirmPassword);
    }

    await this._deleteAssociatedUserData(user);
    await this.userModel.findByIdAndDelete(user._id);

    return {
      message: 'User and all associated data (cheeks, reviews, avatar) have been deleted.',
    };
  }

  // --- Private Helper Methods ---

  // --- Private Helper Methods: General ---
  private _sanitizeUsername(username: string): string {
    if (!username) return '';
    return username
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-') 
      .replace(/[^a-z0-9-]/g, '');
  }

  private _escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
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
      }
    }
  }

  private _toUserObject(userDoc: UserDocument, includePasswordHash: true): UserDocument;
  private _toUserObject(userDoc: UserDocument, includePasswordHash?: false): Omit<UserDocument, 'passwordHash'>;
  private _toUserObject(userDoc: null, includePasswordHash?: boolean): null;
  
  private _toUserObject(
    userDoc: UserDocument | null,
    includePasswordHash = false
  ): UserDocument | Omit<UserDocument, 'passwordHash'> | null {
    if (!userDoc) {
      return null;
    }
    const userObject = userDoc.toObject
      ? userDoc.toObject({ virtuals: true, getters: true })
      : { ...userDoc }; 
      
    if (!includePasswordHash) {
      delete userObject.passwordHash;
    }
    delete userObject.__v;
    
    return userObject as any;
  }
  
  // --- Private Helper Methods: User Creation (for create) ---
  private _validateAndPrepareInitialUserData(createUserDto: CreateUserDto): { sanitizedUsername: string; normalizedEmail: string } {
    const { email } = createUserDto;
    const sanitizedUsername = this._sanitizeUsername(createUserDto.username);
    const normalizedEmail = email.toLowerCase().trim();

    if (!sanitizedUsername) {
      throw new BadRequestException(
        'Username is invalid or became empty after sanitization. Please use alphanumeric characters, spaces, or hyphens.',
      );
    }
    return { sanitizedUsername, normalizedEmail };
  }

  private async _ensureUserDoesNotExist(sanitizedUsername: string, normalizedEmail: string): Promise<void> {
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
  }

  // --- Private Helper Methods: Password Change (for changePassword) ---
  private async _findUserForPasswordChange(userId: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const user = await this.userModel.findById(userId).select('+passwordHash').exec();
    assertUserFound(user);
    if (!user.passwordHash) {
      throw new InternalServerErrorException('User password data is missing.');
    }
    return user;
  }

  private async _validateOldPassword(passwordToVerify: string, passwordHash: string): Promise<void> {
    const isPasswordValid = await bcrypt.compare(passwordToVerify, passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect old password.');
    }
  }
  
  // --- Private Helper Methods: Profile Update (for updateProfile) ---
  private async _validateAndAuthorizeProfileUpdate(
    targetUserId: string,
    requester: { id: string; role: string },
  ): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid target user ID format.');
    }

    const user = await this.userModel.findById(targetUserId).exec();
    assertUserFound(user);

    if (targetUserId !== requester.id && requester.role !== 'admin') {
      throw new ForbiddenException('You are not authorized to update this profile.');
    }
    return user;
  }

  private async _applyProfileDataUpdates(
    user: UserDocument,
    updateUserDto: UpdateUserDto,
  ): Promise<boolean> {
    user.profile = user.profile || {};
    let profileChanged = false;

    if (updateUserDto.displayName !== undefined) {
      const updateResult = await this._updateProfileField(user, 'displayName', updateUserDto.displayName);
      if (updateResult) {
        profileChanged = true;
      }
    }

    if (updateUserDto.bio !== undefined) {
      const updateResult = await this._updateProfileField(user, 'bio', updateUserDto.bio);
      if (updateResult) {
        profileChanged = true;
      }
    }
    return profileChanged;
  }

  private async _updateProfileField(
    user: UserDocument,
    field: 'displayName' | 'bio',
    value: string | undefined,
  ): Promise<boolean> {
    const trimmedValue = value?.trim();
    const currentValue = user.profile?.[field];
    const newValue = trimmedValue === '' ? undefined : trimmedValue;

    if (currentValue !== newValue) {
      if (!user.profile) {
        user.profile = {};
      }
      user.profile[field] = newValue;
      return true;
    }
    return false;
  }

  // --- Private Helper Methods: Avatar Management (for uploadProfileImage, deleteAvatar) ---
  private async _handleCloudinaryUpload(file: File, existingPublicId?: string): Promise<{ secure_url: string; public_id: string }> {
    if (existingPublicId) {
      await this._deleteOldCloudinaryImage(existingPublicId);
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
    return { secure_url: uploadResult.secure_url, public_id: uploadResult.public_id };
  }

  private async _findUserAndValidateProfileImage(userId: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID format.');
    }
    const user = await this.userModel.findById(userId).exec();
    assertUserFound(user);

    if (!user.profile?.profileImagePublicId) { 
      throw new NotFoundException('User does not have a profile image to delete.');
    }
    return user;
  }

  private _clearUserProfileImageDetails(user: UserDocument): void {
    if (user.profile) {
        user.profile.avatarUrl = undefined;
        user.profile.profileImagePublicId = undefined;
        user.markModified('profile');
    }
  }

  // --- Private Helper Methods: User Deletion (for deleteUser) ---
  private async _findUserForDeletion(targetUserId: string, requester: { id: string; role: string }): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid target user ID format.');
    }

    if (targetUserId !== requester.id && requester.role !== 'admin') {
      throw new ForbiddenException('You are not authorized to delete this account.');
    }

    const user = await this.userModel.findById(targetUserId).select('+passwordHash').exec();
    assertUserFound(user);
    return user;
  }

  private async _confirmPasswordForDeletion(user: UserDocument, confirmPassword?: string): Promise<void> {
    if (!user.passwordHash) { 
        throw new InternalServerErrorException('User password data is missing for confirmation.');
    }
    if (!confirmPassword) {
      throw new BadRequestException('Password confirmation is required to delete your own account.');
    }
    const isPasswordConfirmed = await bcrypt.compare(confirmPassword, user.passwordHash);
    if (!isPasswordConfirmed) {
      throw new UnauthorizedException('Password confirmation failed.');
    }
  }

  private async _deleteAssociatedUserData(user: UserDocument): Promise<void> {
    await this.cheekModel.deleteMany({ owner: user._id });
    await this.reviewModel.deleteMany({ userId: user._id }); 
    if (user.profile?.profileImagePublicId) {
      await this._deleteOldCloudinaryImage(user.profile.profileImagePublicId);
    }
  }
}
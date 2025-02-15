import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import {
  Collection,
  CollectionDocument,
} from '../collections/schemas/collection.schema';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService, // For token-based authentication
    @InjectModel(Collection.name)
    private collectionModel: Model<CollectionDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
  ) {}

  /**
   * Register a new user
   */
  async create(createUserDto: CreateUserDto): Promise<{ token: string }> {
    const { username, email, password } = createUserDto;

    // Check if email or username already exists
    const existingUser = await this.userModel.findOne({
      $or: [{ email }, { username }],
    });
    if (existingUser) {
      throw new BadRequestException('Email or username already taken');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = new this.userModel({
      username,
      email,
      passwordHash: hashedPassword,
    });
    await newUser.save();

    // Generate JWT token
    const token = this.jwtService.sign({ id: newUser._id });

    return { token };
  }

  /**
   * Authenticate user and return JWT token
   */
  async login(loginUserDto: LoginUserDto): Promise<{ token: string }> {
    const { email, password } = loginUserDto;

    // Find user by email
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = this.jwtService.sign({ id: user._id });

    return { token };
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    if (!userId) {
      throw new NotFoundException('User ID is missing');
    }
  
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { 
        $set: {
          'profile.displayName': updateUserDto.displayName,
          'profile.bio': updateUserDto.bio,
          'profile.avatarUrl': updateUserDto.avatarUrl,
        }
      },
      { new: true, runValidators: true },
    );
  
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
  
    return updatedUser;
  }
  
  

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { oldPassword, newPassword } = changePasswordDto;

    // Find user
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate old password
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Incorrect old password');
    }

    // Hash new password and update
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return { message: 'Password updated successfully' };
  }

  /**
   * Delete user
   */
  async deleteUser(
    userId: string,
    confirmPassword: string,
  ): Promise<{ message: string }> {
    // Find the user by id
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify the provided password
    const isPasswordValid = await bcrypt.compare(
      confirmPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password confirmation failed');
    }

    // Cascade delete: remove all collections owned by the user
    await this.collectionModel.deleteMany({ owner: userId });
    // Remove all reviews made by the user
    await this.reviewModel.deleteMany({ userId: userId });

    // Finally, delete the user
    await this.userModel.findByIdAndDelete(userId);

    return {
      message:
        'User and all associated collections and reviews have been deleted',
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Query,
  Post,
  Put,
  Req,
  NotFoundException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Patch,
  HttpCode,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserDocument } from './schemas/user.schema';
import { Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard'; // Ensure the correct path to RolesGuard
import { File } from 'multer';
import { Roles } from '../auth/roles.decorator';
import { UpdateUserRoleDto } from './dto/update-user-role.dto'; // New DTO for updating user role

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  /**
   * List all users.
   */
  @Get()
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'List of all users' })
  @ApiOperation({ summary: 'List all users' })
  async findAllUsers() {
    return this.usersService.findAll();
  }
  /**
   * Search users by name (or part of name)
   */
  @Get('search')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'List of users matching the search query' })
  @ApiResponse({ status: 404, description: 'No users found' })
  @ApiOperation({ summary: 'Search users by name' })
  async searchUsers(@Query('name') name: string) {
    if (!name) {
      throw new NotFoundException('Query parameter "name" is required');
    }
    return this.usersService.searchByName(name);
  }

  /**
   * Find a user by username
   */
  @Get('by-username/:username')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiOperation({ summary: 'Find a user by username' })
  async findUserByUsername(@Param('username') username: string) {
    const user = await this.usersService.findUserByUsername(username);
    if (!user) {
      throw new NotFoundException(`User with username ${username} not found`);
    }
    return user;
  }

  /**
   * Find users by minimum cheeks count.
   */
  @Get('by-cheek-count')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'List of users with minimum cheek count' })
  @ApiResponse({ status: 404, description: 'No users found' })
  @ApiOperation({ summary: 'Find users by minimum cheek count' })
  async findUsersByCheekCount(@Query('min') min: string) {
    const minCount = parseInt(min, 10);
    return this.usersService.findByCheekCount(minCount);
  }

  /**
   * Get a user by ID 
   */
  @Get(':id')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiOperation({ summary: 'Get user by ID' })
  async findUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Register a new user
   */
  @Post('register')
  @HttpCode(201)
  @ApiResponse({ status: 201, description: 'User registered' })
  @ApiResponse({ status: 400, description: 'Email or username already taken' })
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  /**
   * Update user profile (Protected: only the user themselves or an admin can update)
   */
  @Patch('profile')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'User profile updated' })
  @ApiResponse({ status: 400, description: 'Email or username already taken' })
  @ApiResponse({ status: 403, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @Body() updateUserDto: UpdateUserDto,
    @Req() req,
  ): Promise<UserResponseDto> {
    const userFromService = await this.usersService.updateProfile(req.user.id, updateUserDto, {
      id: req.user.id,
      role: req.user.role,
    });

    return {
      id: userFromService.id,
      username: userFromService.username,
      email: userFromService.email,
      displayName: userFromService.profile?.displayName,
      bio: userFromService.profile?.bio,
      avatarUrl: userFromService.profile?.avatarUrl,
      role: userFromService.role,
    };
  }

  /**
   * Upload or update user profile image (avatar)
   */
  @Patch('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload or update user profile image (avatar)' })
  @ApiResponse({ status: 200, description: 'Profile image updated' })
  async uploadProfileImage(
    @UploadedFile() file: File,
    @Req() req,
  ): Promise<UserResponseDto> {
    const userFromService = await this.usersService.uploadProfileImage(req.user.id, file);

    return {
      id: userFromService.id,
      username: userFromService.username,
      email: userFromService.email,
      displayName: userFromService.profile?.displayName,
      bio: userFromService.profile?.bio,
      avatarUrl: userFromService.profile?.avatarUrl,
      role: userFromService.role,
    };
  }

  /**
   * Delete user profile image (avatar)
   */
  @Delete('avatar') // New endpoint
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user profile image (avatar)' })
  @ApiResponse({ status: 200, description: 'Profile image deleted successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User or avatar not found' })
  async deleteProfileImage(
    @Req() req,
  ): Promise<UserResponseDto> {
    const userFromService = await this.usersService.deleteAvatar(req.user.id, {
      id: req.user.id,
      role: req.user.role,
    });

    return {
      id: userFromService.id,
      username: userFromService.username,
      email: userFromService.email,
      displayName: userFromService.profile?.displayName,
      bio: userFromService.profile?.bio,
      avatarUrl: userFromService.profile?.avatarUrl, // This should now be undefined or null
      role: userFromService.role,
    };
  }

  @Patch('admin/:userIdToUpdate/role')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Admin: Update a user role' })
  @ApiResponse({ status: 200, description: 'User role updated successfully by admin', type: UserResponseDto }) // Assuming UserResponseDto is suitable
  @ApiResponse({ status: 400, description: 'Invalid role or user ID' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adminUpdateUserRole(
    @Param('userIdToUpdate') userIdToUpdate: string,
    @Body() updateUserRoleDto: UpdateUserRoleDto, // Use the new DTO
    @Req() req, // req.user for admin context if needed by service, though RolesGuard handles auth
  ): Promise<Omit<UserDocument, 'passwordHash'>> { // Or UserResponseDto
    return this.usersService.updateUserRole(userIdToUpdate, updateUserRoleDto.role);
  }

  /**
   * Delete a user account (Admin only)
   */
  @Delete('admin/:userIdToDelete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(200) // Or 204 No Content
  @ApiOperation({ summary: 'Admin: Delete a user account' })
  @ApiResponse({ status: 200, description: 'User deleted successfully by admin' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adminDeleteUser(
    @Param('userIdToDelete') userIdToDelete: string,
    @Req() req, // req.user will contain the admin's details
  ): Promise<{ message: string }> {
    // The 'confirmPassword' argument is null because admins don't need to confirm the user's password.
    // The usersService.deleteUser method already checks if the requester is an admin.
    return this.usersService.deleteUser(userIdToDelete, '', req.user);
  }
}

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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserDocument } from './schemas/user.schema';
import { Types } from 'mongoose';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { HttpCode } from '@nestjs/common';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @Put('profile')
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
    const updatedUser = (await this.usersService.updateProfile(req.user.id, updateUserDto, {
      id: req.user.id,
      role: req.user.role,
    })) as UserDocument;
    return {
      id: (updatedUser._id as Types.ObjectId).toHexString(),
      username: updatedUser.username,
      email: updatedUser.email,
      displayName: updatedUser.profile?.displayName,
      bio: updatedUser.profile?.bio,
      avatarUrl: updatedUser.profile?.avatarUrl,
      role: updatedUser.role,
    };
  }
}

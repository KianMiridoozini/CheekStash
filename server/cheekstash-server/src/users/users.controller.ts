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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List all users' })
  async findAllUsers() {
    return this.usersService.findAll();
  }

  /**
   * Search users by name (or part of name)
   */
  @Get('search')
  @HttpCode(200)
  @ApiOperation({ summary: 'Search users by name' })
  async searchUsers(@Query('name') name: string) {
    if (!name) {
      throw new NotFoundException('Query parameter "name" is required');
    }
    return this.usersService.searchByName(name);
  }

  /**
   * Find users by minimum collection count.
   */
  @Get('by-collections')
  @HttpCode(200)
  @ApiOperation({ summary: 'Find users by minimum collection count' })
  async findUsersByCollectionCount(@Query('min') min: string) {
    const minCount = parseInt(min, 10);
    return this.usersService.findByCollectionCount(minCount);
  }

  /**
   * Get a user by ID 
   */
  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get user by ID' })
  async findUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Register a new user
   */  
  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  /**
   * Update user profile (Protected: only the user themselves or an admin can update)
   */ 
  @Put('profile')
  @HttpCode(200)
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

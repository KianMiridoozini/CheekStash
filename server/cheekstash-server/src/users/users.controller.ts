import {
  Body,
  Controller,
  Post,
  Put,
  Req,
  Delete,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfirmPasswordDto } from './dto/confirm-password.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserDocument } from './schemas/user.schema';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user' })
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.usersService.login(loginUserDto);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(
    @Body() updateUserDto: UpdateUserDto,
    @Req() req,
  ): Promise<UserResponseDto> {
    const updatedUser = (await this.usersService.updateProfile(
      req.user.id,
      updateUserDto,
    )) as UserDocument;
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

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req,
  ) {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Delete user account along with associated collections and reviews',
  })
  async deleteUser(@Req() req, @Body() confirmPasswordDto: ConfirmPasswordDto) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.usersService.deleteUser(
      req.user.id,
      confirmPasswordDto.password,
    );
  }
}

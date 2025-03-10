import {
  Controller,
  Post,
  Body,
  Put,
  Delete,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { ConfirmPasswordDto } from './dto/confirm-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { HttpCode } from '@nestjs/common';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'User authenticated successfully' })
  @ApiOperation({ summary: 'Authenticate user and return JWT' })
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService
      .validateUser(loginUserDto.email, loginUserDto.password)
      .then(user => this.authService.login(user));
  }

  @Put('password')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(@Body() changePasswordDto: ChangePasswordDto, @Req() req) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Delete('account')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user account along with associated collections and reviews' })
  async deleteAccount(@Req() req, @Body() confirmPasswordDto: ConfirmPasswordDto) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.authService.deleteUser(req.user, confirmPasswordDto.password);
  }
}

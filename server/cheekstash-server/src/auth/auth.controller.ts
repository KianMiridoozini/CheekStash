import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Authenticate user and return JWT' })
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.validateUser(loginUserDto.email, loginUserDto.password)
      .then(user => this.authService.login(user));
  }
}

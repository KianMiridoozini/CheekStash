import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
// import { LoginUserDto } from '../users/dto/login-user.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Validate user credentials.
   */
  async validateUser(email: string, password: string): Promise<UserDocument> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  /**
   * Login: Accepts a user document and returns a JWT token.
   */
  async login(user: UserDocument): Promise<{ token: string }> {
    const token = this.jwtService.sign({ id: user._id });
    return { token };
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.usersService.changePassword(userId, changePasswordDto);
  }

  async deleteUser(
    requester: { id: string; role: string },
    confirmPassword: string,
  ): Promise<{ message: string }> {
    return this.usersService.deleteUser(requester.id, confirmPassword, requester);
  }
}

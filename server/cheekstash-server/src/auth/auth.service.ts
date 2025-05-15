import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { assertUserFound } from '../common/guards/user-check.util';

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
    const user = await this.usersService.findByEmail(email, true);
    assertUserFound(user);    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  /**
   * Login: Accepts a user document and returns a JWT token.
   */
  async login(
    user: UserDocument,
  ): Promise<{ token: string; username: string }> {
    const token = this.jwtService.sign({
      id: user._id,
      username: user.username,
      role: user.role,
    });
    return { token, username: user.username };
  }

  /**
   * Get user profile by ID (typically from JWT payload).
   */
  async getUserProfile(userId: string): Promise<Omit<UserDocument, 'passwordHash'>> {
    const user = await this.usersService.findById(userId);
    assertUserFound(user); // Ensures user is not null or undefined
    // The 'user' object from usersService.findById is already a plain object
    // with passwordHash removed by the _toUserObject helper in UsersService.
    // Therefore, no need to call .toObject() or destructure passwordHash here.
    return user;
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
    return this.usersService.deleteUser(
      requester.id,
      confirmPassword,
      requester,
    );
  }
}

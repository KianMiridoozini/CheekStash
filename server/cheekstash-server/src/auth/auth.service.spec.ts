// --- FIX: Declare mock vars BEFORE jest.mock ---
const mockBcryptCompare = jest.fn();
const mockBcryptHash = jest.fn();

// --- FIX: Mock bcrypt using the declared vars ---
jest.mock('bcrypt', () => ({
  compare: mockBcryptCompare,
  hash: mockBcryptHash,
}));
// --- End mock bcrypt ---

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt'; // Keep standard import if needed elsewhere
import { Types } from 'mongoose';
import { ChangePasswordDto } from '../users/dto/change-password.dto';



// Mock UsersService methods used by AuthService
const mockUsersService = {
  findByEmail: jest.fn(),
  changePassword: jest.fn(),
  deleteUser: jest.fn(),
};

// Mock JwtService
const mockJwtService = {
  sign: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  beforeEach(async () => {
    // Reset mocks
    mockBcryptCompare.mockClear();
    mockBcryptHash.mockClear();
    Object.values(mockUsersService).forEach(mockFn => mockFn.mockClear());
    Object.values(mockJwtService).forEach(mockFn => mockFn.mockClear());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test validateUser ---
  describe('validateUser', () => {
    const email = 'test@test.com';
    const password = 'password';
    const mockUser = {
      _id: new Types.ObjectId(),
      email: email,
      username: 'test',
      passwordHash: 'hashedPassword',
      // other fields
    } as UserDocument; // Cast to satisfy type, mock doesn't need all fields

    it('should return user if credentials are valid', async () => {
        // Arrange
        mockUsersService.findByEmail.mockResolvedValueOnce(mockUser);
        mockBcryptCompare.mockResolvedValueOnce(true); // Password matches

        // Act
        const result = await service.validateUser(email, password);

        // Assert
        expect(usersService.findByEmail).toHaveBeenCalledWith(email);
        expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash);
        expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
        // Arrange
        mockUsersService.findByEmail.mockResolvedValueOnce(null); // User not found

        // Act & Assert
        await expect(service.validateUser(email, password)).rejects.toThrow(NotFoundException);
        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password does not match', async () => {
        // Arrange
        mockUsersService.findByEmail.mockResolvedValueOnce(mockUser);
        mockBcryptCompare.mockResolvedValueOnce(false); // Password doesn't match

        // Act & Assert
        await expect(service.validateUser(email, password)).rejects.toThrow(UnauthorizedException);
        expect(bcrypt.compare).toHaveBeenCalledWith(password, mockUser.passwordHash);
    });
  });

  // --- Test login ---
  describe('login', () => {
    const mockUser = {
      _id: new Types.ObjectId(),
      username: 'loginUser',
      // other fields
    } as UserDocument;
    const expectedToken = 'mockJwtToken';

    it('should sign a JWT and return token and username', async () => {
       // Arrange
       mockJwtService.sign.mockReturnValueOnce(expectedToken);

       // Act
       const result = await service.login(mockUser);

       // Assert
       expect(jwtService.sign).toHaveBeenCalledWith({ id: mockUser._id });
       expect(result).toEqual({ token: expectedToken, username: mockUser.username });
    });
  });

   // --- Test changePassword ---
  describe('changePassword', () => {
      const userId = 'userId';
      const changePasswordDto: ChangePasswordDto = { oldPassword: 'old', newPassword: 'new' };
      const successMessage = { message: 'Password updated successfully' };

      it('should delegate password change to UsersService', async () => {
          // Arrange
          mockUsersService.changePassword.mockResolvedValueOnce(successMessage);

          // Act
          const result = await service.changePassword(userId, changePasswordDto);

          // Assert
          expect(usersService.changePassword).toHaveBeenCalledWith(userId, changePasswordDto);
          expect(result).toEqual(successMessage);
      });

       it('should bubble up errors from UsersService', async () => {
           // Arrange
           const error = new UnauthorizedException('Incorrect old password');
           mockUsersService.changePassword.mockRejectedValueOnce(error);

           // Act & Assert
           await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(UnauthorizedException);
       });
  });

  // --- Test deleteUser ---
   describe('deleteUser', () => {
       const requester = { id: 'userId', role: 'user' };
       const confirmPassword = 'password';
       const successMessage = { message: 'User deleted' };

       it('should delegate user deletion to UsersService', async () => {
           // Arrange
           mockUsersService.deleteUser.mockResolvedValueOnce(successMessage);

           // Act
           const result = await service.deleteUser(requester, confirmPassword);

           // Assert
           expect(usersService.deleteUser).toHaveBeenCalledWith(requester.id, confirmPassword, requester);
           expect(result).toEqual(successMessage);
       });

       it('should bubble up errors from UsersService during deletion', async () => {
           // Arrange
           const error = new UnauthorizedException('Password confirmation failed');
           mockUsersService.deleteUser.mockRejectedValueOnce(error);

           // Act & Assert
           await expect(service.deleteUser(requester, confirmPassword)).rejects.toThrow(UnauthorizedException);
       });
   });

});
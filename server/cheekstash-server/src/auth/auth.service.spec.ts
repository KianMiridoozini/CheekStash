// const mockBcryptCompare = jest.fn();
// const mockBcryptHash = jest.fn();

// jest.mock('bcrypt', () => ({
//   compare: mockBcryptCompare,
//   hash: mockBcryptHash,
// }));

// import { Test, TestingModule } from '@nestjs/testing';
// import { JwtService } from '@nestjs/jwt';
// import { AuthService } from './auth.service';
// import { UsersService } from '../users/users.service';
// import { UserDocument } from '../users/schemas/user.schema';
// import { NotFoundException, UnauthorizedException } from '@nestjs/common';
// import * as bcrypt from 'bcrypt'; // Keep standard import if needed elsewhere
// import { Types } from 'mongoose';
// import { ChangePasswordDto } from '../users/dto/change-password.dto';

// describe('AuthService', () => {
//   let service: AuthService;
//   let usersService: UsersService;
//   let jwtService: JwtService;

//   // Use the mockUsersService object when providing the value
//   const mockUsersServiceInstance = {
//     findByEmail: jest.fn(),
//     changePassword: jest.fn(),
//     deleteUser: jest.fn(),
//   };

//   const mockJwtServiceInstance = {
//     sign: jest.fn(),
//   };

//   beforeEach(async () => {
//     // Reset mocks
//     mockBcryptCompare.mockClear();
//     mockBcryptHash.mockClear();
//     Object.values(mockUsersServiceInstance).forEach((mockFn) =>
//       mockFn.mockReset(),
//     );
//     Object.values(mockJwtServiceInstance).forEach((mockFn) =>
//       mockFn.mockReset(),
//     );

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         AuthService,
//         { provide: UsersService, useValue: mockUsersServiceInstance },
//         { provide: JwtService, useValue: mockJwtServiceInstance },
//       ],
//     }).compile();

//     service = module.get<AuthService>(AuthService);
//     usersService = module.get<UsersService>(UsersService);
//     jwtService = module.get<JwtService>(JwtService);
//   });

//   describe('validateUser', () => {
//     const email = 'test@test.com';
//     const password = 'password';
//     const mockUser = {
//       _id: new Types.ObjectId(),
//       email: email,
//       username: 'test',
//       passwordHash: 'hashedPassword',
//       role: 'user',
//     } as UserDocument;

//     it('should return user if credentials are valid', async () => {
//       // Arrange
//       mockUsersServiceInstance.findByEmail.mockResolvedValueOnce(mockUser);
//       mockBcryptCompare.mockResolvedValueOnce(true);

//       // Act
//       const result = await service.validateUser(email, password);

//       // Assert
//       expect(mockUsersServiceInstance.findByEmail).toHaveBeenCalledWith(
//         email,
//         true,
//       );
//       expect(bcrypt.compare).toHaveBeenCalledWith(
//         password,
//         mockUser.passwordHash,
//       );
//       expect(result).toEqual(mockUser);
//     });
//     it('should throw NotFoundException if user not found', async () => {
//       // Arrange
//       mockUsersServiceInstance.findByEmail.mockResolvedValueOnce(null);
//       // Act & Assert
//       await expect(service.validateUser(email, password)).rejects.toThrow(
//         NotFoundException,
//       );
//       expect(mockUsersServiceInstance.findByEmail).toHaveBeenCalledWith(
//         email,
//         true,
//       );
//       expect(bcrypt.compare).not.toHaveBeenCalled();
//     });
//     it('should throw UnauthorizedException if password does not match', async () => {
//       // Arrange
//       mockUsersServiceInstance.findByEmail.mockResolvedValueOnce(mockUser);
//       mockBcryptCompare.mockResolvedValueOnce(false);
//       // Act & Assert
//       await expect(service.validateUser(email, password)).rejects.toThrow(
//         UnauthorizedException,
//       );
//       expect(mockUsersServiceInstance.findByEmail).toHaveBeenCalledWith(
//         email,
//         true,
//       );
//       expect(bcrypt.compare).toHaveBeenCalledWith(
//         password,
//         mockUser.passwordHash,
//       );
//     });
//   });

//   describe('login', () => {
//     // Add role to mock user if it's included in the payload
//     const mockUser = {
//       _id: new Types.ObjectId(),
//       username: 'loginUser',
//       role: 'user',
//     } as UserDocument;
//     const expectedToken = 'mockJwtToken';

//     it('should sign a JWT and return token and username', async () => {
//       // Arrange
//       mockJwtServiceInstance.sign.mockReturnValueOnce(expectedToken);

//       // Act
//       const result = await service.login(mockUser);

//       // Assert

//       expect(mockJwtServiceInstance.sign).toHaveBeenCalledWith({
//         id: mockUser._id,
//         username: mockUser.username,
//         role: mockUser.role,
//       });

//       expect(result).toEqual({
//         token: expectedToken,
//         username: mockUser.username,
//       });
//     });
//   });

//   // --- Test changePassword ---
//   describe('changePassword', () => {
//     const userId = 'userId';
//     const changePasswordDto: ChangePasswordDto = {
//       oldPassword: 'old',
//       newPassword: 'new',
//     };
//     const successMessage = { message: 'Password updated successfully' };

//     it('should delegate password change to UsersService', async () => {
//       // Arrange
//       mockUsersServiceInstance.changePassword.mockResolvedValueOnce(
//         successMessage,
//       );

//       // Act
//       const result = await service.changePassword(userId, changePasswordDto);

//       // Assert
//       expect(mockUsersServiceInstance.changePassword).toHaveBeenCalledWith(
//         userId,
//         changePasswordDto,
//       );
//       expect(result).toEqual(successMessage);
//     });

//     it('should bubble up errors from UsersService', async () => {
//       // Arrange
//       const error = new UnauthorizedException('Incorrect old password');
//       mockUsersServiceInstance.changePassword.mockRejectedValueOnce(error);

//       // Act & Assert
//       await expect(
//         service.changePassword(userId, changePasswordDto),
//       ).rejects.toThrow(UnauthorizedException);
//       expect(mockUsersServiceInstance.changePassword).toHaveBeenCalledWith(
//         userId,
//         changePasswordDto,
//       );
//     });
//   });

//   // --- Test deleteUser ---
//   describe('deleteUser', () => {
//     const requester = { id: 'userId', role: 'user' };
//     const confirmPassword = 'password';
//     const successMessage = { message: 'User deleted' };

//     it('should delegate user deletion to UsersService', async () => {
//       // Arrange
//       mockUsersServiceInstance.deleteUser.mockResolvedValueOnce(successMessage);

//       // Act
//       const result = await service.deleteUser(requester, confirmPassword);

//       // Assert
//       expect(mockUsersServiceInstance.deleteUser).toHaveBeenCalledWith(
//         requester.id,
//         confirmPassword,
//         requester,
//       );
//       expect(result).toEqual(successMessage);
//     });

//     it('should bubble up errors from UsersService during deletion', async () => {
//       // Arrange
//       const error = new UnauthorizedException('Password confirmation failed');
//       mockUsersServiceInstance.deleteUser.mockRejectedValueOnce(error);

//       // Act & Assert
//       await expect(
//         service.deleteUser(requester, confirmPassword),
//       ).rejects.toThrow(UnauthorizedException);
//       expect(mockUsersServiceInstance.deleteUser).toHaveBeenCalledWith(
//         requester.id,
//         confirmPassword,
//         requester,
//       );
//     });
//   });
// });

// // src/auth/auth.controller.spec.ts
// import { Test, TestingModule } from '@nestjs/testing';
// import { AuthController } from './auth.controller';
// import { AuthService } from './auth.service';
// import { JwtAuthGuard } from './jwt-auth.guard';
// import { LoginUserDto } from '../users/dto/login-user.dto';
// import { ChangePasswordDto } from '../users/dto/change-password.dto';
// import { ConfirmPasswordDto } from './dto/confirm-password.dto';
// import { Types } from 'mongoose';
// import { UserDocument } from '../users/schemas/user.schema';
// import { UnauthorizedException } from '@nestjs/common';


// // Mock AuthService
// const mockAuthService = {
//   validateUser: jest.fn(),
//   login: jest.fn(),
//   changePassword: jest.fn(),
//   deleteUser: jest.fn(),
// };

// // Mock Request object
// const mockRequest = (userPayload: any) => ({
//   user: userPayload,
// });

// describe('AuthController', () => {
//   let controller: AuthController;
//   let service: AuthService;

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       controllers: [AuthController],
//       providers: [
//         { provide: AuthService, useValue: mockAuthService },
//       ],
//     })
//     .overrideGuard(JwtAuthGuard)
//     .useValue({ canActivate: jest.fn(() => true) }) // Mock guard to allow access
//     .compile();

//     controller = module.get<AuthController>(AuthController);
//     service = module.get<AuthService>(AuthService);

//     // Clear mocks
//     jest.clearAllMocks();
//   });

//   it('should be defined', () => {
//     expect(controller).toBeDefined();
//   });

//   // --- Test login ---
//   describe('login', () => {
//     const loginUserDto: LoginUserDto = { email: 'test@test.com', password: 'password' };
//     const mockUser = { _id: new Types.ObjectId(), username: 'testUser' } as UserDocument;
//     const loginResult = { token: 'jwtToken', username: 'testUser' };

//     it('should validate user and call login service', async () => {
//       // Arrange
//       mockAuthService.validateUser.mockResolvedValueOnce(mockUser);
//       mockAuthService.login.mockResolvedValueOnce(loginResult);

//       // Act
//       const result = await controller.login(loginUserDto);

//       // Assert
//       expect(service.validateUser).toHaveBeenCalledWith(loginUserDto.email, loginUserDto.password);
//       expect(service.login).toHaveBeenCalledWith(mockUser);
//       expect(result).toEqual(loginResult);
//     });

//     it('should bubble up errors from validateUser', async () => {
//         // Arrange
//         const error = new UnauthorizedException('Invalid credentials');
//         mockAuthService.validateUser.mockRejectedValueOnce(error);

//         // Act & Assert
//         await expect(controller.login(loginUserDto)).rejects.toThrow(UnauthorizedException);
//         expect(service.login).not.toHaveBeenCalled();
//     });
//   });

//    // --- Test changePassword ---
//    describe('changePassword', () => {
//        const changePasswordDto: ChangePasswordDto = { oldPassword: 'old', newPassword: 'new' };
//        const requestingUser = { id: new Types.ObjectId().toHexString(), role: 'user' };
//        const req = mockRequest(requestingUser);
//        const successMessage = { message: 'Password changed successfully' };

//        it('should call authService.changePassword with user id and dto', async () => {
//            // Arrange
//            mockAuthService.changePassword.mockResolvedValueOnce(successMessage);

//            // Act
//            const result = await controller.changePassword(changePasswordDto, req);

//            // Assert
//            expect(service.changePassword).toHaveBeenCalledWith(requestingUser.id, changePasswordDto);
//            expect(result).toEqual(successMessage);
//        });
//    });

//   // --- Test deleteAccount ---
//   describe('deleteAccount', () => {
//       const confirmPasswordDto: ConfirmPasswordDto = { password: 'password' };
//       const requestingUser = { id: new Types.ObjectId().toHexString(), role: 'user' };
//       const req = mockRequest(requestingUser);
//       const successMessage = { message: 'Account deleted successfully' };

//       it('should call authService.deleteUser with requester info and password', async () => {
//           // Arrange
//           mockAuthService.deleteUser.mockResolvedValueOnce(successMessage);

//           // Act
//           const result = await controller.deleteAccount(req, confirmPasswordDto);

//           // Assert
//           expect(service.deleteUser).toHaveBeenCalledWith(requestingUser, confirmPasswordDto.password);
//           expect(result).toEqual(successMessage);
//       });

//        it('should throw UnauthorizedException if req.user is missing', async () => {
//             // Arrange
//             const invalidReq = mockRequest(null); // Simulate user not being attached

//             // Act & Assert
//             // We need to bypass the guard mock for this specific test if the guard normally prevents this
//             // Or we can test the controller logic directly assuming guard passed but user is somehow null
//             await expect(controller.deleteAccount(invalidReq, confirmPasswordDto))
//                 .rejects.toThrow(new UnauthorizedException('User not authenticated'));

//             expect(service.deleteUser).not.toHaveBeenCalled();
//         });

//          it('should throw UnauthorizedException if req.user.id is missing', async () => {
//             // Arrange
//             const invalidReq = mockRequest({ role: 'user' }); // id is missing

//             // Act & Assert
//              await expect(controller.deleteAccount(invalidReq, confirmPasswordDto))
//                 .rejects.toThrow(new UnauthorizedException('User not authenticated'));

//             expect(service.deleteUser).not.toHaveBeenCalled();
//         });
//   });

// });
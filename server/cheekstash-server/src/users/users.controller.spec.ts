// // src/users/users.controller.spec.ts
// import { Test, TestingModule } from '@nestjs/testing';
// import { UsersController } from './users.controller';
// import { UsersService } from './users.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// import { CreateUserDto } from './dto/create-user.dto';
// import { UpdateUserDto } from './dto/update-user.dto';
// import { UserResponseDto } from './dto/user-response.dto';
// import { NotFoundException } from '@nestjs/common';
// import { Types } from 'mongoose';

// // Mock UsersService
// const mockUsersService = {
//   findAll: jest.fn(),
//   searchByName: jest.fn(),
//   findByCheekCount: jest.fn(),
//   findById: jest.fn(),
//   create: jest.fn(),
//   updateProfile: jest.fn(),
//   uploadProfileImage: jest.fn(), // Added for uploadProfileImage
// };

// // Mock Request object for protected routes
// const mockRequest = (userPayload: any) => ({
//   user: userPayload, // Structure mimics what JwtAuthGuard puts on req
// });

// describe('UsersController', () => {
//   let controller: UsersController;
//   let service: UsersService;

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       controllers: [UsersController],
//       providers: [{ provide: UsersService, useValue: mockUsersService }],
//     })
//       .overrideGuard(JwtAuthGuard)
//       .useValue({ canActivate: jest.fn(() => true) }) // Allow access
//       .compile();

//     controller = module.get<UsersController>(UsersController);
//     service = module.get<UsersService>(UsersService);

//     // Clear mocks before each test
//     jest.clearAllMocks();
//   });

//   it('should be defined', () => {
//     expect(controller).toBeDefined();
//   });

//   // --- Test findAllUsers ---
//   describe('findAllUsers', () => {
//     it('should call service.findAll and return the result', async () => {
//       const expectedUsers = [{ id: '1', username: 'user1' }];
//       mockUsersService.findAll.mockResolvedValueOnce(expectedUsers);

//       const result = await controller.findAllUsers();

//       expect(service.findAll).toHaveBeenCalled();
//       expect(result).toEqual(expectedUsers);
//     });
//   });

//   // --- Test searchUsers ---
//   describe('searchUsers', () => {
//     it('should call service.searchByName with the query param', async () => {
//       const nameQuery = 'test';
//       const expectedUsers = [{ id: '1', username: 'testUser' }];
//       mockUsersService.searchByName.mockResolvedValueOnce(expectedUsers);

//       const result = await controller.searchUsers(nameQuery);

//       expect(service.searchByName).toHaveBeenCalledWith(nameQuery);
//       expect(result).toEqual(expectedUsers);
//     });

//     it('should throw NotFoundException if name query is missing', async () => {
//       // Note: NestJS Pipes usually handle this, but your controller code also checks
//       // Test the controller's explicit check.
//       await expect(controller.searchUsers(undefined as any)).rejects.toThrow(
//         NotFoundException,
//       );
//       expect(service.searchByName).not.toHaveBeenCalled();
//     });
//   });

//   // --- Test findUsersByCheekCount ---
//   describe('findUsersByCheekCount', () => {
//     it('should call service.findByCheekCount with the parsed min count', async () => {
//       const minQuery = '5';
//       const expectedUsers = [{ id: '1', username: 'cheekyUser' }];
//       mockUsersService.findByCheekCount.mockResolvedValueOnce(expectedUsers);

//       const result = await controller.findUsersByCheekCount(minQuery);

//       expect(service.findByCheekCount).toHaveBeenCalledWith(5);
//       expect(result).toEqual(expectedUsers);
//     });
//   });

//   // --- Test findUserById ---
//   describe('findUserById', () => {
//     it('should call service.findById with the id param', async () => {
//       const userId = 'someMongoId';
//       const expectedUser = { id: userId, username: 'foundUser' };
//       mockUsersService.findById.mockResolvedValueOnce(expectedUser);

//       const result = await controller.findUserById(userId);

//       expect(service.findById).toHaveBeenCalledWith(userId);
//       expect(result).toEqual(expectedUser);
//     });
//   });

//   // --- Test register ---
//   describe('register', () => {
//     it('should call service.create with the dto', async () => {
//       const createUserDto: CreateUserDto = {
//         username: 'new',
//         email: 'new@test.com',
//         password: 'pw',
//       };
//       const createdUser = {
//         _id: 'newId',
//         username: 'new',
//         email: 'new@test.com',
//       };
//       mockUsersService.create.mockResolvedValueOnce(createdUser);

//       const result = await controller.register(createUserDto);

//       expect(service.create).toHaveBeenCalledWith(createUserDto);
//       expect(result).toEqual(createdUser);
//     });
//   });

//   // --- Test updateProfile ---
//   describe('updateProfile', () => {
//     const updateUserDto: UpdateUserDto = { displayName: 'Updated Name' };
//     const requestingUser = {
//       id: new Types.ObjectId().toHexString(),
//       role: 'user',
//     }; // Mock JWT payload
//     const req = mockRequest(requestingUser); // Mock the NestJS request object
//     const updatedUserDoc = {
//       _id: new Types.ObjectId(requestingUser.id),
//       username: 'test',
//       email: 'test@test.com',
//       role: 'user',
//       profile: {
//         displayName: 'Updated Name',
//         bio: undefined,
//         avatarUrl: undefined,
//       },
//     };

//     it('should call service.updateProfile with user id, dto, and requester info', async () => {
//       // Arrange
//       mockUsersService.updateProfile.mockResolvedValueOnce(updatedUserDoc);

//       // Act
//       const result: UserResponseDto = await controller.updateProfile(
//         updateUserDto,
//         req,
//       );

//       // Assert
//       expect(service.updateProfile).toHaveBeenCalledWith(
//         requestingUser.id,
//         updateUserDto,
//         { id: requestingUser.id, role: requestingUser.role }, // Ensure correct requester info is passed
//       );
//       // Check if the response is mapped correctly to UserResponseDto
//       expect(result).toEqual({
//         id: requestingUser.id,
//         username: updatedUserDoc.username,
//         email: updatedUserDoc.email,
//         displayName: updatedUserDoc.profile.displayName,
//         bio: updatedUserDoc.profile.bio,
//         avatarUrl: updatedUserDoc.profile.avatarUrl,
//         role: updatedUserDoc.role,
//       });
//     });

//     // Add tests for cases where updateProfile might throw errors,
//     // although those errors originate in the service which is already tested.
//     // Focus here is on the controller calling the service correctly.
//   });

//   // --- Test uploadProfileImage ---
//   describe('uploadProfileImage', () => {
//     const requestingUser = {
//       id: new Types.ObjectId().toHexString(),
//       role: 'user',
//     };
//     const req = mockRequest(requestingUser);
//     const mockFile = {
//       fieldname: 'file',
//       originalname: 'avatar.jpg',
//       encoding: '7bit',
//       mimetype: 'image/jpeg',
//       size: 12345,
//       buffer: Buffer.from('mock file content'), // Mock buffer
//     } as any; // Using 'any' for simplicity, or create a proper mock type

//     const updatedUserDoc = {
//       _id: new Types.ObjectId(requestingUser.id),
//       username: 'testUser',
//       email: 'test@example.com',
//       role: 'user',
//       profile: {
//         displayName: 'Test User',
//         bio: 'A bio',
//         avatarUrl: 'http://example.com/new-avatar.jpg',
//       },
//     };

//     it('should call service.uploadProfileImage and return mapped UserResponseDto', async () => {
//       mockUsersService.uploadProfileImage.mockResolvedValueOnce(updatedUserDoc);

//       const result: UserResponseDto = await controller.uploadProfileImage(
//         mockFile,
//         req,
//       );

//       expect(service.uploadProfileImage).toHaveBeenCalledWith(
//         requestingUser.id,
//         mockFile,
//       );
//       expect(result).toEqual({
//         id: requestingUser.id,
//         username: updatedUserDoc.username,
//         email: updatedUserDoc.email,
//         displayName: updatedUserDoc.profile.displayName,
//         bio: updatedUserDoc.profile.bio,
//         avatarUrl: updatedUserDoc.profile.avatarUrl,
//         role: updatedUserDoc.role,
//       });
//     });
//   });
// });

// src/users/users.service.spec.ts
// --- Mock bcrypt ---
// Define mocks first
const mockBcryptCompare = jest.fn();
const mockBcryptHash = jest.fn();

// Mock the ENTIRE 'bcrypt' module
jest.mock('bcrypt', () => ({
  compare: mockBcryptCompare,
  hash: mockBcryptHash,
}));
// --- End mock bcrypt ---
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UsersService } from './users.service';
import { User, UserDocument } from './schemas/user.schema';
import { Cheeks, CheeksDocument } from '../cheeks/schemas/cheek.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CloudinaryService } from '../common/cloudinary.service';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { File } from 'multer';

// --- Mongoose Mocking Setup ---

// Helper to create a base mock document structure with a mock save
const mockUserDocument = (
  dto: Partial<User & { _id: Types.ObjectId | string }> = {},
): UserDocument & { save: jest.Mock } => {
  const docId = dto._id || new Types.ObjectId();
  const plainObject = {
    _id: docId.toString(), // Use string ID
    username: dto.username || 'testuser',
    email: dto.email || 'test@test.com',
    // Correctly handle explicit undefined for passwordHash
    passwordHash: dto.hasOwnProperty('passwordHash') ? dto.passwordHash : 'hashedPassword',
    profile: dto.profile || {},
    role: dto.role || 'user',
    // Add other default fields from your schema
    followedUsers: [], // Example
    createdAt: new Date().toISOString(), // Example
    updatedAt: new Date().toISOString(), // Example
    __v: 0, // Example
  };

  // The "document" structure
  const mockDoc = {
    ...plainObject,
    _id: docId,
    save: jest.fn(), // Initialize save mock
    toJSON: jest.fn().mockReturnValue(plainObject),
  };
  // Make save resolve with the "document" instance for chaining/mutation checks
  mockDoc.save.mockResolvedValue(mockDoc);

  return mockDoc as unknown as UserDocument & { save: jest.Mock };
};

// Helper to create mock query objects (like the result of find, findOne etc.)
const mockQuery = (resolveValue: any = null) => ({
  exec: jest.fn().mockResolvedValue(resolveValue),
  select: jest.fn().mockReturnThis(), // Chainable
  lean: jest.fn().mockReturnThis(), // Chainable
  populate: jest.fn().mockReturnThis(), // Chainable
  sort: jest.fn().mockReturnThis(), // Chainable
  limit: jest.fn().mockReturnThis(), // Chainable
});

// --- Define MockUserModel class again ---
class MockUserModel {
  constructor(dto) {
    return mockUserDocument(dto);
  }
  static findOne = jest.fn();
  static find = jest.fn();
  static findById = jest.fn();
  static findByIdAndUpdate = jest.fn();
  static findByIdAndDelete = jest.fn();
  static clearMocks = () => {
    MockUserModel.findOne.mockClear();
    MockUserModel.find.mockClear();
    MockUserModel.findById.mockClear();
    MockUserModel.findByIdAndUpdate.mockClear();
    MockUserModel.findByIdAndDelete.mockClear();
  };
}
// Mock factories for other models
const createMockCheekModel = () => ({
  aggregate: jest.fn(),
  deleteMany: jest.fn(),
});
const createMockReviewModel = () => ({
  deleteMany: jest.fn(),
});
// --- End Mongoose Mocking Setup ---

describe('UsersService', () => {
  let service: UsersService;
  let userModelMock: typeof MockUserModel; // This is the class itself
  let cheekModel: ReturnType<typeof createMockCheekModel>;
  let reviewModel: ReturnType<typeof createMockReviewModel>;
  let cloudinaryService: any;

  beforeEach(async () => {
    jest.clearAllMocks(); // Clears all mocks, including bcrypt and jest.fn() instances

    // Reset static mocks on MockUserModel class
    MockUserModel.findOne.mockReset();
    MockUserModel.find.mockReset();
    MockUserModel.findById.mockReset();
    MockUserModel.findByIdAndUpdate.mockReset();
    MockUserModel.findByIdAndDelete.mockReset();

    cheekModel = createMockCheekModel(); // Re-create for fresh mocks
    reviewModel = createMockReviewModel(); // Re-create for fresh mocks
    cloudinaryService = {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: MockUserModel }, // Provide the class
        { provide: getModelToken(Cheeks.name), useValue: cheekModel },
        { provide: getModelToken(Review.name), useValue: reviewModel },
        { provide: CloudinaryService, useValue: cloudinaryService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    // userModelMock will be the MockUserModel class itself because that's what's provided.
    // The service internally will use `new this.userModel()` or `this.userModel.staticMethod()`.
    userModelMock = module.get<typeof MockUserModel>(getModelToken(User.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test create Method ---
  describe('create', () => {
    const createUserDto: CreateUserDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    };
    const hashedPassword = 'hashedPasswordCreate';
    // expectedSavedUser can be used with expect.objectContaining or to check specific fields
    const expectedSavedUserProperties = {
      username: createUserDto.username,
      email: createUserDto.email,
      passwordHash: hashedPassword,
      // profile: {}, // Default profile from mockUserDocument
      // role: 'user', // Default role from mockUserDocument
    };

    it('should create a new user successfully', async () => {
      MockUserModel.findOne.mockResolvedValue(null); // No existing user
      mockBcryptHash.mockResolvedValue(hashedPassword);
      // The MockUserModel constructor returns a mockUserDocument which has a save mock.
      // The save mock on mockUserDocument resolves with itself.

      const result = await service.create(createUserDto);

      expect(MockUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: createUserDto.email }, { username: createUserDto.username }],
      });
      expect(mockBcryptHash).toHaveBeenCalledWith(createUserDto.password, 10);
      // newUser.save() is called internally by the service.
      // The result is the saved document.
      expect(result.username).toBe(createUserDto.username);
      expect(result.email).toBe(createUserDto.email);
      expect(result.passwordHash).toBe(hashedPassword);
      expect(result.save).toHaveBeenCalled(); // Verify the save method on the document was called
    });

    it('should throw BadRequestException if email already exists', async () => {
      MockUserModel.findOne.mockResolvedValue(
        mockUserDocument({ email: createUserDto.email }),
      );

      await expect(service.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        'Email or username already taken',
      );
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if username already exists', async () => {
      MockUserModel.findOne.mockResolvedValue(
        mockUserDocument({ username: createUserDto.username }),
      );

      await expect(service.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        'Email or username already taken',
      );
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });
  });

  // --- Test findAll Method ---
  describe('findAll', () => {
    it('should return an array of users without passwordHash', async () => {
      const mockUsers = [
        mockUserDocument({ username: 'user1' }),
        mockUserDocument({ username: 'user2' }),
      ];
      const queryMock = mockQuery(mockUsers);
      MockUserModel.find.mockReturnValue(queryMock);

      const result = await service.findAll();

      expect(MockUserModel.find).toHaveBeenCalledTimes(1);
      expect(queryMock.select).toHaveBeenCalledWith('-passwordHash');
      expect(queryMock.exec).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUsers);
    });
  });

  // --- Test findById Method ---
  describe('findById', () => {
    const userId = new Types.ObjectId().toHexString();
    const mockUserData = mockUserDocument({ _id: userId, username: 'foundUser' });

    it('should find a user by ID without passwordHash', async () => {
      const queryMock = mockQuery(mockUserData);
      MockUserModel.findById.mockReturnValue(queryMock);

      const result = await service.findById(userId);

      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(queryMock.select).toHaveBeenCalledWith('-passwordHash');
      expect(result).toEqual(mockUserData);
    });

    it('should throw NotFoundException if user not found', async () => {
      const queryMock = mockQuery(null);
      MockUserModel.findById.mockReturnValue(queryMock);

      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
      expect(queryMock.select).toHaveBeenCalledWith('-passwordHash');
    });
  });

  // --- Test findByEmail Method ---
  describe('findByEmail', () => {
    const email = 'find@test.com';
    const baseMockUser = { _id: 'id_email_test', email: email, username: 'testEmailUser' };
    const mockUserWithHash = mockUserDocument({ ...baseMockUser, passwordHash: 'hashedFindByEmail' });
    const mockUserWithoutHash = mockUserDocument({ ...baseMockUser, passwordHash: undefined });


    it('should return a user with passwordHash if includePasswordHash is true', async () => {
      const queryMock = mockQuery(mockUserWithHash);
      MockUserModel.findOne.mockReturnValue(queryMock);

      const result = await service.findByEmail(email, true);

      expect(MockUserModel.findOne).toHaveBeenCalledWith({ email });
      expect(queryMock.select).toHaveBeenCalledWith('+passwordHash');
      expect(result).toEqual(mockUserWithHash);
      expect(result!.passwordHash).toBe('hashedFindByEmail');
    });

    it('should return a user without passwordHash if includePasswordHash is false (assuming schema select:false for hash)', async () => {
      const queryMock = mockQuery(mockUserWithoutHash);
      MockUserModel.findOne.mockReturnValue(queryMock);
      const selectSpy = jest.spyOn(queryMock, 'select');

      const result = await service.findByEmail(email, false);

      expect(MockUserModel.findOne).toHaveBeenCalledWith({ email });
      expect(selectSpy).not.toHaveBeenCalledWith('+passwordHash');
      selectSpy.mockRestore();

      expect(result).toEqual(mockUserWithoutHash);
      expect(result!.passwordHash).toBeUndefined();
    });

    it('should return null if user not found', async () => {
      MockUserModel.findOne.mockReturnValue(mockQuery(null));
      const result = await service.findByEmail(email); // includePasswordHash defaults to false
      expect(result).toBeNull();
    });
  });

  // --- Test searchByName Method ---
  describe('searchByName', () => {
    const nameQuery = 'test';
    const mockUsersData = [
      mockUserDocument({ username: 'testUserSearch' }),
      mockUserDocument({ profile: { displayName: 'Another TestUser' } }),
    ];

    it('should return users matching the name query (username or displayName)', async () => {
      const queryMock = mockQuery(mockUsersData);
      MockUserModel.find.mockReturnValue(queryMock);

      const result = await service.searchByName(nameQuery);

      expect(MockUserModel.find).toHaveBeenCalledWith({
        $or: [
          { username: { $regex: nameQuery, $options: 'i' } },
          { 'profile.displayName': { $regex: nameQuery, $options: 'i' } },
        ],
      });
      expect(queryMock.select).toHaveBeenCalledWith('-passwordHash');
      expect(result).toEqual(mockUsersData);
    });

    it('should throw NotFoundException if no users match', async () => {
      const queryMock = mockQuery([]);
      MockUserModel.find.mockReturnValue(queryMock);

      await expect(service.searchByName(nameQuery)).rejects.toThrow(NotFoundException);
      await expect(service.searchByName(nameQuery)).rejects.toThrow('No users found with the given name');
    });

    it('should throw BadRequestException for other errors during search', async () => {
      const queryMock = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('DB error')),
      };
      MockUserModel.find.mockReturnValue(queryMock as any);

      await expect(service.searchByName(nameQuery)).rejects.toThrow(BadRequestException);
      await expect(service.searchByName(nameQuery)).rejects.toThrow('An error occurred while searching for users');
    });
  });

  // --- Test findByCheekCount Method ---
  describe('findByCheekCount', () => {
    const minCount = 3;
    const userId1 = new Types.ObjectId();
    const userId2 = new Types.ObjectId();
    const aggregationResult = [
      { _id: userId1, count: 5 },
      { _id: userId2, count: 3 },
    ];
    const foundUsersData = [
      mockUserDocument({ _id: userId1, username: 'user1' }),
      mockUserDocument({ _id: userId2, username: 'user2' }),
    ];

    it('should return users with cheek count greater than or equal to min', async () => {
      cheekModel.aggregate.mockResolvedValue(aggregationResult);
      const userQueryMock = mockQuery(foundUsersData);
      MockUserModel.find.mockReturnValue(userQueryMock);

      const result = await service.findByCheekCount(minCount);

      expect(cheekModel.aggregate).toHaveBeenCalledWith([
        { $group: { _id: '$owner', count: { $sum: 1 } } },
        { $match: { count: { $gte: minCount } } },
      ]);
      expect(MockUserModel.find).toHaveBeenCalledWith({ _id: { $in: [userId1, userId2] } });
      expect(userQueryMock.select).toHaveBeenCalledWith('-passwordHash');
      expect(result).toEqual(foundUsersData);
    });

    it('should throw NotFoundException if aggregation returns no users', async () => {
      cheekModel.aggregate.mockResolvedValue([]);

      await expect(service.findByCheekCount(minCount)).rejects.toThrow(NotFoundException);
      await expect(service.findByCheekCount(minCount)).rejects.toThrow('No users found with the given minimum cheek count');
      expect(MockUserModel.find).not.toHaveBeenCalled();
    });
    
    it('should return empty array if aggregation finds user IDs but userModel.find returns no matching users', async () => {
      cheekModel.aggregate.mockResolvedValue(aggregationResult);
      const userQueryMock = mockQuery([]); // Simulate users not found in user collection
      MockUserModel.find.mockReturnValue(userQueryMock);

      const result = await service.findByCheekCount(minCount);

      expect(MockUserModel.find).toHaveBeenCalledWith({ _id: { $in: [userId1, userId2] } });
      expect(result).toEqual([]);
    });
  });

  // --- Test updateProfile Method ---
  describe('updateProfile', () => {
    const targetUserId = new Types.ObjectId().toHexString();
    const requesterSelf = { id: targetUserId, role: 'user' as 'user' | 'admin' };
    const requesterAdmin = { id: new Types.ObjectId().toHexString(), role: 'admin' as 'user' | 'admin' };
    const requesterOtherUser = { id: new Types.ObjectId().toHexString(), role: 'user' as 'user' | 'admin' };

    const updateUserDto: UpdateUserDto = {
      displayName: 'New Name',
      bio: 'New Bio',
      avatarUrl: 'http://newavatar.com/img.png',
    };
    const initialUserData = mockUserDocument({ _id: targetUserId, username: 'targetuser' });
    const updatedUserData = mockUserDocument({
      ...initialUserData,
      _id: targetUserId, // Ensure _id is correctly passed
      profile: {
        displayName: updateUserDto.displayName,
        bio: updateUserDto.bio,
        avatarUrl: updateUserDto.avatarUrl,
      },
    });

    it('should update profile successfully if requester is self', async () => {
      MockUserModel.findByIdAndUpdate.mockResolvedValue(updatedUserData);
      const result = await service.updateProfile(targetUserId, updateUserDto, requesterSelf);
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        targetUserId,
        { $set: {
            'profile.displayName': updateUserDto.displayName,
            'profile.bio': updateUserDto.bio,
            'profile.avatarUrl': updateUserDto.avatarUrl,
        }},
        { new: true, runValidators: true },
      );
      expect(result).toEqual(updatedUserData);
    });

    it('should update profile successfully if requester is admin', async () => {
      MockUserModel.findByIdAndUpdate.mockResolvedValue(updatedUserData);
      const result = await service.updateProfile(targetUserId, updateUserDto, requesterAdmin);
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(result).toEqual(updatedUserData);
    });

    it('should throw UnauthorizedException if requester is not self or admin', async () => {
      await expect(
        service.updateProfile(targetUserId, updateUserDto, requesterOtherUser),
      ).rejects.toThrow(UnauthorizedException);
      expect(MockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
    
    it('should handle partial updates correctly', async () => {
      const partialUpdateDto: UpdateUserDto = { displayName: 'Only Name' };
      const expectedDbUpdate = { 'profile.displayName': 'Only Name' };
      const partiallyUpdatedUserData = mockUserDocument({ ...initialUserData, _id: targetUserId, profile: { displayName: 'Only Name' }});
      MockUserModel.findByIdAndUpdate.mockResolvedValue(partiallyUpdatedUserData);

      await service.updateProfile(targetUserId, partialUpdateDto, requesterSelf);
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        targetUserId,
        { $set: expectedDbUpdate },
        { new: true, runValidators: true },
      );
    });

    it('should throw NotFoundException if user to update is not found', async () => {
      MockUserModel.findByIdAndUpdate.mockResolvedValue(null);
      await expect(
        service.updateProfile(targetUserId, updateUserDto, requesterSelf),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- Test changePassword Method ---
  describe('changePassword', () => {
    const userId = new Types.ObjectId().toHexString();
    const changePasswordDto: ChangePasswordDto = { oldPassword: 'oldP', newPassword: 'newP' };
    const currentHashedPassword = 'hashedOldPassword';
    const newHashedPassword = 'hashedNewPassword';
    let userDocWithPassword: UserDocument & { save: jest.Mock };

    beforeEach(() => {
      // Create a fresh mock document for each test to avoid interference with .save() calls etc.
      userDocWithPassword = mockUserDocument({ _id: userId, passwordHash: currentHashedPassword });
      // bcrypt mocks are cleared in the main beforeEach
    });

    it('should change password successfully with correct old password', async () => {
      const findByIdQueryMock = mockQuery(userDocWithPassword);
      MockUserModel.findById.mockReturnValue(findByIdQueryMock);
      mockBcryptCompare.mockResolvedValue(true);
      mockBcryptHash.mockResolvedValue(newHashedPassword);

      const result = await service.changePassword(userId, changePasswordDto);

      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(findByIdQueryMock.select).toHaveBeenCalledWith('+passwordHash');
      expect(mockBcryptCompare).toHaveBeenCalledWith(changePasswordDto.oldPassword, currentHashedPassword);
      expect(mockBcryptHash).toHaveBeenCalledWith(changePasswordDto.newPassword, 10);
      expect(userDocWithPassword.passwordHash).toBe(newHashedPassword);
      expect(userDocWithPassword.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ message: 'Password updated successfully' });
    });

    it('should throw UnauthorizedException if old password does not match', async () => {
      const findByIdQueryMock = mockQuery(userDocWithPassword);
      MockUserModel.findById.mockReturnValue(findByIdQueryMock);
      mockBcryptCompare.mockResolvedValue(false);

      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow('Incorrect old password');
      expect(userDocWithPassword.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      MockUserModel.findById.mockReturnValue(mockQuery(null));
      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(NotFoundException);
      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });
  });

  // --- Test deleteUser Method ---
  describe('deleteUser', () => {
    const targetUserId = new Types.ObjectId().toHexString();
    const confirmPassword = 'password123';
    const requesterSelf = { id: targetUserId, role: 'user' as 'user' | 'admin' };
    const requesterAdmin = { id: new Types.ObjectId().toHexString(), role: 'admin' as 'user' | 'admin' };
    const requesterOtherUser = { id: new Types.ObjectId().toHexString(), role: 'user' as 'user' | 'admin' };
    const hashedPassword = 'hashedTargetUserPassword';
    let userDocToDelete: UserDocument & { save: jest.Mock };


    beforeEach(() => {
      userDocToDelete = mockUserDocument({ _id: targetUserId, passwordHash: hashedPassword });
      // Other mocks (bcrypt, model static methods) are reset in main/specific beforeEach
      cheekModel.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 }); // Default mock response
      reviewModel.deleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 }); // Default mock response
      MockUserModel.findByIdAndDelete.mockResolvedValue(userDocToDelete); // Default mock response
    });

    it('should delete user successfully if requester is self and password matches', async () => {
      const findByIdQueryMock = mockQuery(userDocToDelete);
      MockUserModel.findById.mockReturnValue(findByIdQueryMock);
      mockBcryptCompare.mockResolvedValue(true);

      const result = await service.deleteUser(targetUserId, confirmPassword, requesterSelf);

      expect(MockUserModel.findById).toHaveBeenCalledWith(targetUserId);
      expect(findByIdQueryMock.select).toHaveBeenCalledWith('+passwordHash');
      expect(mockBcryptCompare).toHaveBeenCalledWith(confirmPassword, hashedPassword);
      expect(cheekModel.deleteMany).toHaveBeenCalledWith({ owner: targetUserId });
      expect(reviewModel.deleteMany).toHaveBeenCalledWith({ userId: targetUserId });
      expect(MockUserModel.findByIdAndDelete).toHaveBeenCalledWith(targetUserId);
      expect(result).toEqual({ message: 'User and all associated cheeks and reviews have been deleted' });
    });

    it('should delete user successfully if requester is admin and password matches', async () => {
      const findByIdQueryMock = mockQuery(userDocToDelete);
      MockUserModel.findById.mockReturnValue(findByIdQueryMock);
      mockBcryptCompare.mockResolvedValue(true);
      
      await service.deleteUser(targetUserId, confirmPassword, requesterAdmin);

      expect(mockBcryptCompare).toHaveBeenCalledWith(confirmPassword, hashedPassword);
      expect(MockUserModel.findByIdAndDelete).toHaveBeenCalledWith(targetUserId);
    });
    
    it('should throw UnauthorizedException if requester is not self or admin', async () => {
      await expect(
        service.deleteUser(targetUserId, confirmPassword, requesterOtherUser),
      ).rejects.toThrow(UnauthorizedException);
      expect(MockUserModel.findById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password confirmation fails', async () => {
      const findByIdQueryMock = mockQuery(userDocToDelete);
      MockUserModel.findById.mockReturnValue(findByIdQueryMock);
      mockBcryptCompare.mockResolvedValue(false);

      await expect(
        service.deleteUser(targetUserId, confirmPassword, requesterSelf),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.deleteUser(targetUserId, confirmPassword, requesterSelf),
      ).rejects.toThrow('Password confirmation failed');
      expect(MockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user to delete is not found', async () => {
      MockUserModel.findById.mockReturnValue(mockQuery(null));
      await expect(
        service.deleteUser(targetUserId, confirmPassword, requesterSelf),
      ).rejects.toThrow(NotFoundException);
      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });
  });

  // --- Test uploadProfileImage Method ---
  describe('uploadProfileImage', () => {
    const userId = new Types.ObjectId().toHexString();
    const mockFile = {
      fieldname: 'avatar', originalname: 'avatar.jpg', encoding: '7bit', mimetype: 'image/jpeg',
      size: 12345, buffer: Buffer.from('fakeImageData'), stream: null, destination: '', filename: '', path: '',
    } as File;
    const oldProfileImagePublicId = 'old_public_id';
    const newUploadResult = {
      secure_url: 'http://newavatar.cloudinary.com/img.jpg',
      public_id: 'new_public_id',
    };
    let userDoc: UserDocument & { save: jest.Mock };

    it('should upload new image and update user profile (no old image)', async () => {
      userDoc = mockUserDocument({ _id: userId, profile: {} });
      MockUserModel.findById.mockResolvedValue(userDoc);
      cloudinaryService.uploadImage.mockResolvedValue(newUploadResult);

      const result = await service.uploadProfileImage(userId, mockFile);

      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(cloudinaryService.deleteImage).not.toHaveBeenCalled();
      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(mockFile);
      expect(userDoc.profile.avatarUrl).toBe(newUploadResult.secure_url);
      expect(userDoc.profile.profileImagePublicId).toBe(newUploadResult.public_id);
      expect(userDoc.save).toHaveBeenCalledTimes(1);
      expect(result.profile.avatarUrl).toBe(newUploadResult.secure_url);
    });

    it('should delete old image, upload new, and update profile (with old image)', async () => {
      userDoc = mockUserDocument({
        _id: userId,
        profile: { avatarUrl: 'old_url', profileImagePublicId: oldProfileImagePublicId },
      });
      MockUserModel.findById.mockResolvedValue(userDoc);
      cloudinaryService.uploadImage.mockResolvedValue(newUploadResult);
      cloudinaryService.deleteImage.mockResolvedValue({}); // Successful deletion

      const result = await service.uploadProfileImage(userId, mockFile);

      expect(cloudinaryService.deleteImage).toHaveBeenCalledWith(oldProfileImagePublicId);
      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(mockFile);
      expect(userDoc.profile.avatarUrl).toBe(newUploadResult.secure_url);
      expect(userDoc.save).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if user not found', async () => {
      MockUserModel.findById.mockResolvedValue(null);
      await expect(service.uploadProfileImage(userId, mockFile)).rejects.toThrow(NotFoundException);
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
    });

    it('should throw an error if deleting the old image fails and not proceed with upload', async () => {
      userDoc = mockUserDocument({
        _id: userId,
        profile: { avatarUrl: 'old_url', profileImagePublicId: oldProfileImagePublicId },
      });
      MockUserModel.findById.mockResolvedValue(userDoc);
      const deleteError = new Error('Cloudinary delete failed');
      cloudinaryService.deleteImage.mockRejectedValue(deleteError);
      cloudinaryService.uploadImage.mockResolvedValue(newUploadResult);

      await expect(service.uploadProfileImage(userId, mockFile)).rejects.toThrow(deleteError);

      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(cloudinaryService.deleteImage).toHaveBeenCalledWith(oldProfileImagePublicId);
      expect(cloudinaryService.uploadImage).not.toHaveBeenCalled();
      expect(userDoc.save).not.toHaveBeenCalled();
    });
  });
});

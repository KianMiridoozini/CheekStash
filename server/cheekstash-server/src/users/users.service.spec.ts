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
import * as bcrypt from 'bcrypt';
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
    passwordHash: dto.passwordHash || 'hashedPassword', // Include hash
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

// Define the mock class for the User Model
// Static methods are mocked directly.
// The constructor returns a mocked document instance.
const createMockUserModel = () => ({
  // Mock static methods directly on the object
  findOne: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  // Add the constructor mock if the service actually uses `new this.userModel()`
  // If the service ONLY calls static methods like findById, findOne, etc.,
  // you don't strictly need to mock the constructor on this object.
  // However, your 'create' method uses `new this.userModel()`, so we need it.
  // Let's mock it to return a basic saveable doc.
  // Note: The TYPE of the injected value will be this object, not a class.
  // The service code uses `new (this.userModel as any)(...)` if it news it up.
  // Let's assume the service code IS `new this.userModel(...)`
  // We need to provide something constructible or adjust service code/mocking.

  // *** SAFER APPROACH: Keep MockUserModel class but instantiate it in factory ***
  // Let's revert to keeping MockUserModel class but control instantiation/static mocks better.
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
  let userModelMock: typeof MockUserModel;
  let cheekModel: ReturnType<typeof createMockCheekModel>;
  let reviewModel: ReturnType<typeof createMockReviewModel>;
  let cloudinaryService: any;

  // Define shared mockSave function *if* needed across tests, otherwise define in test
  // let mockSave: jest.Mock; // If needed

  beforeEach(async () => {
    // Reset mocks FIRST
    jest.clearAllMocks();
    // Manually reset the static methods on the class since new instances are created for each test
    MockUserModel.findOne.mockReset();
    MockUserModel.find.mockReset();
    MockUserModel.findById.mockReset();
    MockUserModel.findByIdAndUpdate.mockReset();
    MockUserModel.findByIdAndDelete.mockReset();

    cheekModel = createMockCheekModel();
    reviewModel = createMockReviewModel();
    cloudinaryService = {
      uploadImage: jest.fn(),
      deleteImage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: MockUserModel },
        { provide: getModelToken(Cheeks.name), useValue: cheekModel },
        { provide: getModelToken(Review.name), useValue: reviewModel },
        { provide: CloudinaryService, useValue: cloudinaryService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    // Get the injected value, which is our MockUserModel class
    userModelMock = module.get<typeof MockUserModel>(getModelToken(User.name));

    // Ensure the injected mock is the one being configured
    // This comparison might not work perfectly due to Jest wrappers
    // console.log('Is injected userModelMock the same as MockUserModel class?', userModelMock === MockUserModel);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test create Method ---
  describe('create', () => {
    const createUserDto: CreateUserDto = {
      username: 'test',
      email: 'test@test.com',
      password: 'password',
    };
    const hashedPassword = 'hashedPasswordCreate';
    // Define what the saved user should look like
    // const savedUserId = new Types.ObjectId();  // Use if needed, otherwise expect.any
    const expectedSavedUser = {
      // Data shape of the *resolved* saved user
      _id: expect.any(Types.ObjectId),
      username: createUserDto.username,
      email: createUserDto.email,
      passwordHash: hashedPassword,
      profile: {},
      role: 'user',
    };

    // No need for TestSpecificMockUserModel or instanceSaveMock here anymore

    beforeEach(() => {
      // Reset mocks if needed specifically for this suite,
      // but the main beforeEach should handle general resets.
      // No need to reset instanceSaveMock as it's removed.
    });

    it('should create a new user successfully', async () => {
      // Arrange
      MockUserModel.findOne.mockResolvedValue(null); // User does not exist
      mockBcryptHash.mockResolvedValueOnce(hashedPassword);

      // 3. The MockUserModel constructor (via mockUserDocument) will create an instance
      //    with a .save() mock. We trust the service calls it.
      //    The default save mock in mockUserDocument resolves with the instance data.
      //    Let's ensure our expectedSavedUser matches what that mock would resolve with.

      // Act
      const result = await service.create(createUserDto);

      // Assert
      // 1. Check findOne was called correctly
      expect(MockUserModel.findOne).toHaveBeenCalledWith({
        $or: [
          { email: createUserDto.email },
          { username: createUserDto.username },
        ],
      });
      // 2. Check bcrypt.hash was called (means we proceeded past the findOne check)
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);

      // 3. Check the result returned by the service matches the expected *saved* user data.
      //    This implicitly tests that the constructor was called AND the save() mock on the
      //    resulting instance resolved correctly.
      expect(result).toMatchObject(expectedSavedUser);
    });

    it('should throw BadRequestException if email exists', async () => {
      // Arrange
      MockUserModel.findOne.mockResolvedValue({
        email: createUserDto.email,
        _id: 'someId',
      }); // Simulate finding a user

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        'Email or username already taken',
      );

      expect(MockUserModel.findOne).toHaveBeenCalledWith({
        $or: [
          { email: createUserDto.email },
          { username: createUserDto.username },
        ],
      });
      expect(bcrypt.hash).not.toHaveBeenCalled(); // Verify hashing didn't happen
    });

    it('should throw BadRequestException if username exists', async () => {
      // Arrange
      MockUserModel.findOne.mockResolvedValue({
        username: createUserDto.username,
        _id: 'someId',
      }); // Simulate finding a user

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        'Email or username already taken',
      );

      expect(MockUserModel.findOne).toHaveBeenCalledWith({
        $or: [
          { email: createUserDto.email },
          { username: createUserDto.username },
        ],
      });
      expect(bcrypt.hash).not.toHaveBeenCalled(); // Verify hashing didn't happen
    });
  });

  // --- Test findAll Method ---
  describe('findAll', () => {
    it('should return an array of users without passwordHash', async () => {
      // Arrange
      const usersData = [
        {
          _id: 'id1',
          username: 'user1',
          email: 'e1@mail.com',
          profile: {},
          role: 'user',
        },
        {
          _id: 'id2',
          username: 'user2',
          email: 'e2@mail.com',
          profile: {},
          role: 'user',
        },
      ];
      // Create a query mock that resolves with the data
      const mockFindQuery = mockQuery(usersData);
      // Mock the static find method to return the query mock
      MockUserModel.find.mockReturnValue(mockFindQuery as any);

      // Act
      const result = await service.findAll();

      // Assert
      expect(MockUserModel.find).toHaveBeenCalled(); // Check static find call
      expect(mockFindQuery.select).toHaveBeenCalledWith('-passwordHash'); // Check select was called
      expect(mockFindQuery.exec).toHaveBeenCalled(); // Check exec was called
      expect(result).toEqual(usersData);
    });
  });

  // --- Test findById Method ---
  describe('findById', () => {
    const userId = new Types.ObjectId().toHexString();
    const mockUserData = {
      _id: userId,
      username: 'foundUser',
      email: 'found@test.com',
      profile: {},
      role: 'user',
    };

    it('should find a user by ID without passwordHash', async () => {
      // Arrange
      const mockFindByIdQuery = mockQuery(mockUserData);
      MockUserModel.findById.mockReturnValue(mockFindByIdQuery as any);

      // Act
      const result = await service.findById(userId);

      // Assert
      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockFindByIdQuery.select).toHaveBeenCalledWith('-passwordHash');
      expect(mockFindByIdQuery.exec).toHaveBeenCalled();
      expect(result).toEqual(mockUserData);
    });
  });

  // --- Test findByEmail Method ---
  describe('findByEmail', () => {
    const email = 'find@test.com';
    // This method SHOULD return the hash
    const mockUserWithHash = {
      _id: 'id_email',
      email: email,
      username: 'testEmail',
      passwordHash: 'hashedFindByEmail',
      profile: {},
      role: 'user',
    };

    it('should return a user (with hash) if found', async () => {
      // Arrange
      const mockFindOneQuery = mockQuery(mockUserWithHash); // Mock query resolves with the user data
      MockUserModel.findOne.mockReturnValue(mockFindOneQuery as any); // findOne returns the query object

      // Act
      const result = await service.findByEmail(email);

      // Assert
      expect(MockUserModel.findOne).toHaveBeenCalledWith({ email });
      expect(mockFindOneQuery.exec).toHaveBeenCalled();
      expect(mockFindOneQuery.select).not.toHaveBeenCalled();
      expect(result).toEqual(mockUserWithHash);
    });

    it('should return null if user not found', async () => {
      // Arrange
      const mockFindOneQuery = mockQuery(null); // Mock query resolves with null
      MockUserModel.findOne.mockReturnValue(mockFindOneQuery as any); // findOne returns the query object

      // Act
      const result = await service.findByEmail(email);

      // Assert
      expect(MockUserModel.findOne).toHaveBeenCalledWith({ email });
      expect(mockFindOneQuery.exec).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  // --- Test searchByName Method ---
  describe('searchByName', () => {
    const nameQuery = 'test';
    const mockUsersData = [
      {
        _id: 'idSearch',
        username: 'testUserSearch',
        email: 'search@mail.com',
        profile: {},
        role: 'user',
      },
    ];

    it('should return users matching the name query', async () => {
      // Arrange
      const mockFindQuery = mockQuery(mockUsersData);
      MockUserModel.find.mockReturnValue(mockFindQuery as any);

      // Act
      const result = await service.searchByName(nameQuery);

      // Assert
      const expectedQuery = {
        $or: [
          { username: { $regex: nameQuery, $options: 'i' } },
          { 'profile.displayName': { $regex: nameQuery, $options: 'i' } },
        ],
      };
      expect(MockUserModel.find).toHaveBeenCalledWith(expectedQuery);
      expect(mockFindQuery.select).toHaveBeenCalledWith('-passwordHash');
      expect(mockFindQuery.exec).toHaveBeenCalled();
      expect(result).toEqual(mockUsersData);
    });

    it('should throw NotFoundException if no users match', async () => {
      // Arrange
      const mockFindQuery = mockQuery([]); // Resolve with empty array
      MockUserModel.find.mockReturnValue(mockFindQuery as any);

      // Act & Assert
      await expect(service.searchByName(nameQuery)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.searchByName(nameQuery)).rejects.toThrow(
        'No users found with the given name',
      );

      expect(mockFindQuery.select).toHaveBeenCalledWith('-passwordHash'); // Select is called before exec/check
      expect(mockFindQuery.exec).toHaveBeenCalled(); // Exec is called, returns []
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
      {
        _id: userId1,
        username: 'user1',
        email: 'u1@mail.com',
        profile: {},
        role: 'user',
      },
      {
        _id: userId2,
        username: 'user2',
        email: 'u2@mail.com',
        profile: {},
        role: 'user',
      },
    ];

    it('should return users with minimum cheek count', async () => {
      // Arrange
      // Mock the aggregation result from cheekModel
      cheekModel.aggregate.mockResolvedValueOnce(aggregationResult);
      // Mock the find query on userModel
      const mockFindQuery = mockQuery(foundUsersData);
      MockUserModel.find.mockReturnValue(mockFindQuery as any);

      // Act
      const result = await service.findByCheekCount(minCount);

      // Assert
      // 1. Check aggregation call
      const expectedAggregationPipeline = [
        { $group: { _id: '$owner', count: { $sum: 1 } } },
        { $match: { count: { $gte: minCount } } },
      ];
      expect(cheekModel.aggregate).toHaveBeenCalledWith(
        expectedAggregationPipeline,
      );
      // 2. Check userModel find call
      expect(MockUserModel.find).toHaveBeenCalledWith({
        _id: { $in: [userId1, userId2] },
      });
      // 3. Check query chaining and execution
      expect(mockFindQuery.select).toHaveBeenCalledWith('-passwordHash');
      expect(mockFindQuery.exec).toHaveBeenCalled();
      // 4. Check final result
      expect(result).toEqual(foundUsersData);
    });

    it('should throw NotFoundException if aggregation returns no users', async () => {
      // Arrange
      // Ensure the mock resolves with an empty array
      cheekModel.aggregate.mockResolvedValueOnce([]); // Aggregation finds no matching groups

      // Act & Assert
      // Call the service method ONCE within the expect block
      await expect(service.findByCheekCount(minCount)).rejects.toThrow(
        new NotFoundException(
          'No users found with the given minimum cheek count',
        ),
      );

      // Verify aggregation was called
      expect(cheekModel.aggregate).toHaveBeenCalledWith([
        { $group: { _id: '$owner', count: { $sum: 1 } } },
        { $match: { count: { $gte: minCount } } },
      ]);
      // Ensure userModel.find was not called if aggregation was empty
      expect(MockUserModel.find).not.toHaveBeenCalled();
    });
  });

  // --- Test updateProfile Method ---
  describe('updateProfile', () => {
    const targetUserId = new Types.ObjectId().toHexString();
    const requester = { id: targetUserId, role: 'user' }; // User updating self
    const adminRequester = {
      id: new Types.ObjectId().toHexString(),
      role: 'admin',
    }; // Admin updating user
    const updateUserDto: UpdateUserDto = {
      displayName: 'New Name',
      bio: 'New Bio',
    };
    // Expected result after successful update
    const updatedUserDocData = {
      _id: new Types.ObjectId(targetUserId),
      username: 'testuser',
      email: 'test@test.com',
      passwordHash: 'hashedPassword',
      profile: {
        displayName: updateUserDto.displayName,
        bio: updateUserDto.bio,
      }, // Updated profile
      role: 'user',
    };

    it('should update profile successfully by the user themselves', async () => {
      // Arrange
      // findByIdAndUpdate resolves directly with the updated document (or null)
      MockUserModel.findByIdAndUpdate.mockResolvedValueOnce(updatedUserDocData);

      // Act
      const result = await service.updateProfile(
        targetUserId,
        updateUserDto,
        requester,
      );

      // Assert
      const expectedUpdatePayload = {
        $set: { 'profile.displayName': 'New Name', 'profile.bio': 'New Bio' },
      };
      const expectedOptions = { new: true, runValidators: true };
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        targetUserId,
        expectedUpdatePayload,
        expectedOptions,
      );
      // toMatchObject since the mock resolves with a specific ObjectId instance
      expect(result).toMatchObject(updatedUserDocData);
    });

    it('should update profile successfully by an admin', async () => {
      // Arrange
      MockUserModel.findByIdAndUpdate.mockResolvedValueOnce(updatedUserDocData);

      // Act
      const result = await service.updateProfile(
        targetUserId,
        updateUserDto,
        adminRequester,
      );

      // Assert
      const expectedUpdatePayload = {
        $set: { 'profile.displayName': 'New Name', 'profile.bio': 'New Bio' },
      };
      const expectedOptions = { new: true, runValidators: true };
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        targetUserId,
        expectedUpdatePayload,
        expectedOptions,
      );
      expect(result).toMatchObject(updatedUserDocData);
    });

    it('should throw UnauthorizedException if requester is not owner or admin', async () => {
      // Arrange
      const unauthorizedRequester = {
        id: new Types.ObjectId().toHexString(),
        role: 'user',
      };

      // Act & Assert
      await expect(
        service.updateProfile(
          targetUserId,
          updateUserDto,
          unauthorizedRequester,
        ),
      ).rejects.toThrow(UnauthorizedException);
      // Ensure DB was not called
      expect(MockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user to update is not found', async () => {
      // Arrange
      MockUserModel.findByIdAndUpdate.mockResolvedValueOnce(null); // Simulate user not found

      // Act & Assert
      await expect(
        service.updateProfile(targetUserId, updateUserDto, requester),
      ) // Use authorized requester
        .rejects.toThrow(NotFoundException);
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        targetUserId,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should only update fields present in the DTO', async () => {
      // Arrange
      const partialDto: UpdateUserDto = { displayName: 'Partial Name' };
      const partialUpdatedUserData = {
        ...updatedUserDocData, // Use base structure
        profile: { displayName: partialDto.displayName },
      };
      MockUserModel.findByIdAndUpdate.mockResolvedValueOnce(
        partialUpdatedUserData,
      );

      // Act
      const result = await service.updateProfile(
        targetUserId,
        partialDto,
        requester,
      );

      // Assert
      const expectedPartialUpdatePayload = {
        $set: { 'profile.displayName': 'Partial Name' },
      };
      const expectedOptions = { new: true, runValidators: true };
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        targetUserId,
        expectedPartialUpdatePayload,
        expectedOptions,
      );
      expect(result).toMatchObject(partialUpdatedUserData);
    });
  });

  // --- Test changePassword Method ---
  describe('changePassword', () => {
    const userId = new Types.ObjectId().toHexString();
    const changePasswordDto: ChangePasswordDto = {
      oldPassword: 'oldPassword123',
      newPassword: 'newPassword456',
    };
    const hashedOldPassword = 'hashedOldPassword_changeTest';
    const hashedNewPassword = 'hashedNewPassword_changeTest';

    // Remove mockFindByIdQuery and the corresponding beforeEach setup for it.
    // We will create mocks inside each test now.

    it('should change password successfully with correct old password', async () => {
      // Arrange
      // Create the user instance findById should eventually resolve with
      const mockUserInstance = mockUserDocument({
        _id: new Types.ObjectId(userId),
        passwordHash: hashedOldPassword,
      });

      // Mock findById to directly return a Promise resolving to the user instance.
      // This assumes the service internally calls .select().exec(), but we bypass mocking those steps.
      MockUserModel.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockUserInstance),
      } as any); // Use 'as any' to bypass strict type checking for the mock chain

      // Mock bcrypt functions
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockBcryptHash.mockResolvedValueOnce(hashedNewPassword);

      // Act
      const result = await service.changePassword(userId, changePasswordDto);

      // Assert
      // Verify findById was called (we can't easily verify select/exec with this mock style)
      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);

      // Verify password logic
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.oldPassword,
        hashedOldPassword,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(
        changePasswordDto.newPassword,
        10,
      );

      // Verify save was called on the instance returned by the mock's exec
      expect(mockUserInstance.save).toHaveBeenCalled(); // Check the specific instance

      // Verify result and state
      expect(result).toEqual({ message: 'Password updated successfully' });
      expect(mockUserInstance.passwordHash).toBe(hashedNewPassword);
    });

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
      // Mock findById -> select -> exec chain to resolve null at the end.
      MockUserModel.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(null), // Simulate user not found
      } as any);

      // Act & Assert
      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(NotFoundException); // Expect NotFound

      // Verify findById was called
      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);

      // Verify subsequent steps NOT called
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if old password does not match', async () => {
      // Arrange
      const mockUserInstance = mockUserDocument({
        // Create instance with hash
        _id: new Types.ObjectId(userId),
        passwordHash: hashedOldPassword,
      });
      const execMock = jest.fn().mockResolvedValue(mockUserInstance);
      const selectMock = jest.fn().mockReturnValueOnce({ exec: execMock });
      MockUserModel.findById.mockImplementationOnce(() => ({
        select: selectMock,
      }));

      mockBcryptCompare.mockResolvedValueOnce(false);

      // Act & Assert
      await expect(
        service.changePassword(userId, changePasswordDto),
      ).rejects.toThrow(new UnauthorizedException('Incorrect old password'));

      // Verify the call chain
      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(selectMock).toHaveBeenCalledWith('+passwordHash');
      expect(execMock).toHaveBeenCalled();

      // Verify password logic
      expect(bcrypt.compare).toHaveBeenCalledWith(
        changePasswordDto.oldPassword,
        mockUserInstance.passwordHash, // Check against the instance's hash
      );

      // Assert subsequent steps NOT called
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockUserInstance.save).not.toHaveBeenCalled();
    });
  }); // End describe 'changePassword'

  // --- Test deleteUser Method ---
  describe('deleteUser', () => {
    const targetUserId = new Types.ObjectId().toHexString();
    const requester = { id: targetUserId, role: 'user' };
    const adminRequester = {
      id: new Types.ObjectId().toHexString(),
      role: 'admin',
    };
    const confirmPassword = 'correctPasswordDelete';
    const hashedPassword = 'hashedPassword_deleteTest';

    // Create the mock instance needed for successful finds
    const mockUserInstanceForDelete = mockUserDocument({
      _id: new Types.ObjectId(targetUserId),
      passwordHash: hashedPassword,
    });

    it('should delete user, cheeks, and reviews successfully by the user themselves', async () => {
      // Arrange
      const mockUserInstance = mockUserDocument({
        // Instance with hash
        _id: new Types.ObjectId(targetUserId),
        passwordHash: hashedPassword,
      });
      const execMock = jest.fn().mockResolvedValue(mockUserInstance);
      const selectMock = jest.fn().mockReturnValueOnce({ exec: execMock });
      // Mock findById to return object with select
      MockUserModel.findById.mockImplementationOnce(() => ({
        select: selectMock,
      }));

      // Mock bcrypt compare, cascade deletes, final delete
      mockBcryptCompare.mockResolvedValueOnce(true);
      cheekModel.deleteMany.mockResolvedValueOnce({
        acknowledged: true,
        deletedCount: 2,
      });
      reviewModel.deleteMany.mockResolvedValueOnce({
        acknowledged: true,
        deletedCount: 5,
      });
      MockUserModel.findByIdAndDelete.mockResolvedValueOnce(
        mockUserInstanceForDelete,
      );

      // Act
      const result = await service.deleteUser(
        targetUserId,
        confirmPassword,
        requester,
      );

      // Assert
      expect(MockUserModel.findById).toHaveBeenCalledWith(targetUserId);
      expect(selectMock).toHaveBeenCalledWith('+passwordHash');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        confirmPassword,
        hashedPassword,
      );
      expect(execMock).toHaveBeenCalled();
      expect(cheekModel.deleteMany).toHaveBeenCalledWith({
        owner: targetUserId,
      });
      expect(reviewModel.deleteMany).toHaveBeenCalledWith({
        userId: targetUserId,
      });
      expect(MockUserModel.findByIdAndDelete).toHaveBeenCalledWith(
        targetUserId,
      );
      expect(result).toEqual({
        message: 'User and all associated cheeks and reviews have been deleted',
      });
    });

    it('should delete user, cheeks, and reviews successfully by an admin', async () => {
      // Arrange
      const mockUserInstance = mockUserDocument({
        _id: new Types.ObjectId(targetUserId),
        passwordHash: hashedPassword,
      });
      // Mock findById to return object with select and exec
      const execMock = jest.fn().mockResolvedValue(mockUserInstance);

      const selectMock = jest.fn().mockReturnValueOnce({ exec: execMock });
      MockUserModel.findById.mockImplementationOnce(() => ({
        select: selectMock,
      }));

      // Mock bcrypt compare, cascades, delete
      mockBcryptCompare.mockResolvedValueOnce(true);
      cheekModel.deleteMany.mockResolvedValueOnce({
        acknowledged: true,
        deletedCount: 1,
      });
      reviewModel.deleteMany.mockResolvedValueOnce({
        acknowledged: true,
        deletedCount: 3,
      });
      MockUserModel.findByIdAndDelete.mockResolvedValueOnce(
        mockUserInstanceForDelete,
      );

      // Act
      const result = await service.deleteUser(
        targetUserId,
        confirmPassword,
        adminRequester,
      );

      // Assert (similar to above)
      expect(MockUserModel.findById).toHaveBeenCalledWith(targetUserId);
      expect(selectMock).toHaveBeenCalledWith('+passwordHash');
      expect(execMock).toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        confirmPassword,
        hashedPassword,
      );
      expect(cheekModel.deleteMany).toHaveBeenCalledWith({
        owner: targetUserId,
      });
      expect(reviewModel.deleteMany).toHaveBeenCalledWith({
        userId: targetUserId,
      });
      expect(MockUserModel.findByIdAndDelete).toHaveBeenCalledWith(
        targetUserId,
      );
      expect(result).toEqual({
        message: 'User and all associated cheeks and reviews have been deleted',
      });
    });

    it('should throw UnauthorizedException if requester is not owner or admin', async () => {
      // Arrange
      const unauthorizedRequester = {
        id: new Types.ObjectId().toHexString(),
        role: 'user',
      };
      // No DB interaction expected, so no findById mock needed

      // Act & Assert
      await expect(
        service.deleteUser(
          targetUserId,
          confirmPassword,
          unauthorizedRequester,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.deleteUser(
          targetUserId,
          confirmPassword,
          unauthorizedRequester,
        ),
      ).rejects.toThrow('You are not allowed to delete this account');

      // Ensure no DB operations or password checks were attempted
      expect(MockUserModel.findById).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(cheekModel.deleteMany).not.toHaveBeenCalled();
      expect(reviewModel.deleteMany).not.toHaveBeenCalled();
      expect(MockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user to delete is not found', async () => {
      // Arrange
      const execMock = jest.fn().mockResolvedValue(null); // exec resolves null
      const selectMock = jest.fn().mockReturnValueOnce({ exec: execMock });
      MockUserModel.findById.mockImplementationOnce(() => ({
        select: selectMock,
      }));

      // Act & Assert
      await expect(
        service.deleteUser(targetUserId, confirmPassword, requester),
      ).rejects.toThrow(NotFoundException);

      expect(MockUserModel.findById).toHaveBeenCalledWith(targetUserId);
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(cheekModel.deleteMany).not.toHaveBeenCalled();
      expect(reviewModel.deleteMany).not.toHaveBeenCalled();
      expect(MockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password confirmation fails', async () => {
      // Arrange
      const mockUserInstance = mockUserDocument({
        _id: new Types.ObjectId(targetUserId),
        passwordHash: hashedPassword,
      });
      const execMock = jest.fn().mockResolvedValue(mockUserInstance);

      const selectMock = jest.fn().mockReturnValueOnce({ exec: execMock });
      MockUserModel.findById.mockImplementationOnce(() => ({
        select: selectMock,
      }));

      // 2. bcrypt compare fails
      mockBcryptCompare.mockResolvedValueOnce(false);

      // Act & Assert
      await expect(
        service.deleteUser(targetUserId, confirmPassword, requester),
      ).rejects.toThrow(
        new UnauthorizedException('Password confirmation failed'),
      );

      expect(MockUserModel.findById).toHaveBeenCalledWith(targetUserId);
      expect(selectMock).toHaveBeenCalledWith('+passwordHash');
      expect(execMock).toHaveBeenCalled(); // Check the specific instance
      expect(bcrypt.compare).toHaveBeenCalledWith(
        confirmPassword,
        hashedPassword,
      );
      expect(cheekModel.deleteMany).not.toHaveBeenCalled();
      expect(reviewModel.deleteMany).not.toHaveBeenCalled();
      expect(MockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });

  // --- Test uploadProfileImage Method ---
  describe('uploadProfileImage', () => {
    it('should upload a new image, delete the old one, and update the user profile', async () => {
      const userId = 'user123';
      const file = { buffer: Buffer.from('test') } as File;
      const oldPublicId = 'old-public-id';
      const userDoc = {
        profile: { profileImagePublicId: oldPublicId, avatarUrl: undefined },
        save: jest.fn().mockResolvedValue(true),
      };
      MockUserModel.findById.mockResolvedValue(userDoc);
      cloudinaryService.uploadImage.mockResolvedValue({
        secure_url: 'http://cloudinary.com/new.jpg',
        public_id: 'new-public-id',
      });
      cloudinaryService.deleteImage.mockResolvedValue(true);

      await service.uploadProfileImage(userId, file);

      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(cloudinaryService.deleteImage).toHaveBeenCalledWith(oldPublicId);
      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith(file);
      expect(userDoc.profile.avatarUrl).toBe('http://cloudinary.com/new.jpg');
      expect(userDoc.profile.profileImagePublicId).toBe('new-public-id');
      expect(userDoc.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user is not found', async () => {
      MockUserModel.findById.mockResolvedValue(null);
      await expect(
        service.uploadProfileImage('badid', {} as File),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

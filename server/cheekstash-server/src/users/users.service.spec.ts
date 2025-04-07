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
import { Cheeks, CheeksDocument } from '../cheeks/schemas/cheeks.schema';
import { Review, ReviewDocument } from '../reviews/schemas/review.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';




// --- Mongoose Mocking Setup ---

// Helper to create a base mock document structure with a mock save
const mockUserDocument = (dto: Partial<User & { _id: Types.ObjectId | string }> = {}): UserDocument & { save: jest.Mock } => {
  const docId = dto._id || new Types.ObjectId();
  const baseDoc = {
    _id: docId,
    username: dto.username || 'testuser',
    email: dto.email || 'test@test.com',
    passwordHash: dto.passwordHash || 'hashedPassword',
    profile: dto.profile || {},
    role: dto.role || 'user',
    // Add any other default fields from your schema if needed
  };

  // The save mock should resolve with the document itself (or the updated version)
  const saveMock = jest.fn().mockResolvedValue({ ...baseDoc, ...dto, _id: docId }); // Ensure save resolves with the final state

  return {
    ...baseDoc,
    ...dto, // Apply overrides from dto
    _id: docId, // Ensure _id is consistent
    save: saveMock, // Attach the mock save function
  } as unknown as UserDocument & { save: jest.Mock }; // Cast needed as UserDocument doesn't explicitly have save type
};


// Helper to create mock query objects (like the result of find, findOne etc.)
const mockQuery = (resolveValue: any = null) => ({
    exec: jest.fn().mockResolvedValue(resolveValue),
    select: jest.fn().mockReturnThis(), // Chainable
    lean: jest.fn().mockReturnThis(),   // Chainable
    populate: jest.fn().mockReturnThis(),// Chainable
    sort: jest.fn().mockReturnThis(),    // Chainable
    limit: jest.fn().mockReturnThis(),   // Chainable
});


// Define the mock class for the User Model
// Static methods are mocked directly.
// The constructor returns a mocked document instance.
class MockUserModel {
    // The constructor mock will be called when `new this.userModel()` happens in the service
    constructor(dto) {
        // Return a document structure with a SAVE mock
        // We don't usually need to assert on the constructor directly,
        // but rather on the static methods or the 'save' of the instance returned.
        return mockUserDocument(dto);
    }

    // Static methods mocked with jest.fn()
    static findOne = jest.fn();
    static find = jest.fn();
    static findById = jest.fn();
    static findByIdAndUpdate = jest.fn();
    static findByIdAndDelete = jest.fn();

    // Helper to clear mocks between tests
    static clearMocks = () => {
        MockUserModel.findOne.mockClear();
        MockUserModel.find.mockClear();
        MockUserModel.findById.mockClear();
        MockUserModel.findByIdAndUpdate.mockClear();
        MockUserModel.findByIdAndDelete.mockClear();
        // We also need to reset the implementation/return values if they were set with mockResolvedValueOnce etc.
        MockUserModel.findOne.mockReset(); // Resets mock, implementation, and return value
        MockUserModel.find.mockReset();
        MockUserModel.findById.mockReset();
        MockUserModel.findByIdAndUpdate.mockReset();
        MockUserModel.findByIdAndDelete.mockReset();
    }
}

// Mock factories for other models
const createMockCheekModel = () => ({
    aggregate: jest.fn(),
    deleteMany: jest.fn()
});
const createMockReviewModel = () => ({
    deleteMany: jest.fn()
});
// --- End Mongoose Mocking Setup ---


describe('UsersService', () => {
  let service: UsersService;
  // Use 'typeof MockUserModel' for the type of the provider value
  let userModel: typeof MockUserModel;
  let cheekModel: ReturnType<typeof createMockCheekModel>;
  let reviewModel: ReturnType<typeof createMockReviewModel>;

  // Define shared mockSave function *if* needed across tests, otherwise define in test
  let mockSave: jest.Mock; // Example if needed

  beforeEach(async () => {
    // Reset ALL mocks (Jest mocks like bcrypt, and Mongoose static mocks)
    jest.clearAllMocks();
    MockUserModel.clearMocks(); // Use the static clearMocks helper

    // Re-configure any default mock behaviors if necessary after clearAllMocks
    // e.g., mockBcryptHash.mockResolvedValue('defaultHashedPassword');

    // Create fresh mock instances for dependency injection
    cheekModel = createMockCheekModel();
    reviewModel = createMockReviewModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        // Provide the MockUserModel *class* itself when the User model token is requested
        { provide: getModelToken(User.name), useValue: MockUserModel },
        { provide: getModelToken(Cheeks.name), useValue: cheekModel },
        { provide: getModelToken(Review.name), useValue: reviewModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    // Get the injected value, which is our MockUserModel class
    userModel = module.get<typeof MockUserModel>(getModelToken(User.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test create Method ---
  describe('create', () => {
    const createUserDto: CreateUserDto = { username: 'test', email: 'test@test.com', password: 'password' };
    const hashedPassword = 'hashedPasswordCreate';
    // Define what the saved user should look like
    const savedUserId = new Types.ObjectId(); // Use if needed, otherwise expect.any
    const expectedSavedUser = { // Data shape of the *resolved* saved user
        _id: expect.any(Types.ObjectId), // Use expect.any for generated IDs
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
      // 1. Mock findOne to find no existing user
      MockUserModel.findOne.mockResolvedValue(null); // User does not exist

      // 2. Mock bcrypt hash result
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
          $or: [{ email: createUserDto.email }, { username: createUserDto.username }],
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
      MockUserModel.findOne.mockResolvedValue({ email: createUserDto.email, _id: 'someId' }); // Simulate finding a user

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createUserDto)).rejects.toThrow('Email or username already taken');

      expect(MockUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: createUserDto.email }, { username: createUserDto.username }],
      });
      expect(bcrypt.hash).not.toHaveBeenCalled(); // Verify hashing didn't happen
    });

    it('should throw BadRequestException if username exists', async () => {
      // Arrange
      MockUserModel.findOne.mockResolvedValue({ username: createUserDto.username, _id: 'someId' }); // Simulate finding a user

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createUserDto)).rejects.toThrow('Email or username already taken');

       expect(MockUserModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: createUserDto.email }, { username: createUserDto.username }],
      });
      expect(bcrypt.hash).not.toHaveBeenCalled(); // Verify hashing didn't happen
    });
  }); // End describe 'create'

  // --- Test findAll Method ---
  describe('findAll', () => {
    it('should return an array of users without passwordHash', async () => {
      // Arrange
      const usersData = [
          { _id: 'id1', username: 'user1', email: 'e1@mail.com', profile: {}, role: 'user' },
          { _id: 'id2', username: 'user2', email: 'e2@mail.com', profile: {}, role: 'user' }
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
    const mockUserData = { _id: userId, username: 'foundUser', email: 'found@test.com', profile: {}, role: 'user' };

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

    it('should throw NotFoundException if user not found', async () => {
      // Arrange
       const mockFindByIdQuery = mockQuery(null); // Resolve with null
       MockUserModel.findById.mockReturnValue(mockFindByIdQuery as any);

      // Act & Assert
      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
      expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockFindByIdQuery.select).toHaveBeenCalledWith('-passwordHash');
      expect(mockFindByIdQuery.exec).toHaveBeenCalled();
    });
  });

  // --- Test findByEmail Method ---
  describe('findByEmail', () => {
    const email = 'find@test.com';
    // This method SHOULD return the hash
    const mockUserWithHash = { _id: 'id_email', email: email, username: 'testEmail', passwordHash: 'hashedFindByEmail', profile: {}, role: 'user' };

    it('should return a user (with hash) if found', async () => {
      // Arrange
      const mockFindOneQuery = mockQuery(mockUserWithHash); // Mock query resolves with the user data
      MockUserModel.findOne.mockReturnValue(mockFindOneQuery as any); // findOne returns the query object

      // Act
      const result = await service.findByEmail(email);

      // Assert
      expect(MockUserModel.findOne).toHaveBeenCalledWith({ email }); // Check findOne was called
      expect(mockFindOneQuery.exec).toHaveBeenCalled(); // Check exec was called on the query object
      // Service method findByEmail doesn't use .select()
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
       expect(mockFindOneQuery.exec).toHaveBeenCalled(); // exec should still be called
      expect(result).toBeNull();
    });
  });

  // --- Test searchByName Method ---
  describe('searchByName', () => {
    const nameQuery = 'test';
    const mockUsersData = [{ _id: 'idSearch', username: 'testUserSearch', email: 'search@mail.com', profile: {}, role: 'user' }];

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
       await expect(service.searchByName(nameQuery)).rejects.toThrow(NotFoundException);
       await expect(service.searchByName(nameQuery)).rejects.toThrow('No users found with the given name');

       expect(mockFindQuery.select).toHaveBeenCalledWith('-passwordHash'); // Select is called before exec/check
       expect(mockFindQuery.exec).toHaveBeenCalled(); // Exec is called, returns []
    });
  });

  // --- Test findByCheekCount Method ---
  describe('findByCheekCount', () => {
    const minCount = 3;
    const userId1 = new Types.ObjectId();
    const userId2 = new Types.ObjectId();
    const aggregationResult = [ { _id: userId1, count: 5 }, { _id: userId2, count: 3 } ];
    const foundUsersData = [
        { _id: userId1, username: 'user1', email: 'u1@mail.com', profile: {}, role: 'user' },
        { _id: userId2, username: 'user2', email: 'u2@mail.com', profile: {}, role: 'user' }
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
      expect(cheekModel.aggregate).toHaveBeenCalledWith(expectedAggregationPipeline);
      // 2. Check userModel find call
      expect(MockUserModel.find).toHaveBeenCalledWith({ _id: { $in: [userId1, userId2] } });
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
      await expect(service.findByCheekCount(minCount))
        .rejects.toThrow(new NotFoundException('No users found with the given minimum cheek count'));
      // ^^^ Check for the specific exception instance and message

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
    const adminRequester = { id: new Types.ObjectId().toHexString(), role: 'admin' }; // Admin updating user
    const updateUserDto: UpdateUserDto = { displayName: 'New Name', bio: 'New Bio' };
    // Expected result after successful update
    const updatedUserDocData = {
        _id: new Types.ObjectId(targetUserId), // Match ID
        username: 'testuser', // Assuming base username
        email: 'test@test.com', // Assuming base email
        passwordHash: 'hashedPassword', // Not selected, but present in underlying mock
        profile: { displayName: updateUserDto.displayName, bio: updateUserDto.bio }, // Updated profile
        role: 'user',
    };

    it('should update profile successfully by the user themselves', async () => {
      // Arrange
      // findByIdAndUpdate resolves directly with the updated document (or null)
      MockUserModel.findByIdAndUpdate.mockResolvedValueOnce(updatedUserDocData);

      // Act
      const result = await service.updateProfile(targetUserId, updateUserDto, requester);

      // Assert
      const expectedUpdatePayload = {
          $set: { 'profile.displayName': 'New Name', 'profile.bio': 'New Bio' }
      };
      const expectedOptions = { new: true, runValidators: true };
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        targetUserId,
        expectedUpdatePayload,
        expectedOptions
      );
      // Use toMatchObject because the mock resolves with a specific ObjectId instance
      expect(result).toMatchObject(updatedUserDocData);
    });

     it('should update profile successfully by an admin', async () => {
      // Arrange
      MockUserModel.findByIdAndUpdate.mockResolvedValueOnce(updatedUserDocData);

      // Act
      const result = await service.updateProfile(targetUserId, updateUserDto, adminRequester);

      // Assert
      const expectedUpdatePayload = {
          $set: { 'profile.displayName': 'New Name', 'profile.bio': 'New Bio' }
      };
      const expectedOptions = { new: true, runValidators: true };
      expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        targetUserId,
        expectedUpdatePayload,
        expectedOptions
      );
      expect(result).toMatchObject(updatedUserDocData);
    });

    it('should throw UnauthorizedException if requester is not owner or admin', async () => {
      // Arrange
      const unauthorizedRequester = { id: new Types.ObjectId().toHexString(), role: 'user' }; // Different user ID

      // Act & Assert
      await expect(service.updateProfile(targetUserId, updateUserDto, unauthorizedRequester))
        .rejects.toThrow(UnauthorizedException);
       // Ensure DB was not called
       expect(MockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user to update is not found', async () => {
       // Arrange
       MockUserModel.findByIdAndUpdate.mockResolvedValueOnce(null); // Simulate user not found

       // Act & Assert
       await expect(service.updateProfile(targetUserId, updateUserDto, requester)) // Use authorized requester
         .rejects.toThrow(NotFoundException);
       expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(targetUserId, expect.any(Object), expect.any(Object));
    });

    it('should only update fields present in the DTO', async () => {
       // Arrange
       const partialDto: UpdateUserDto = { displayName: 'Partial Name' };
       const partialUpdatedUserData = {
            ...updatedUserDocData, // Use base structure
            profile: { displayName: partialDto.displayName } // Only displayName updated
       };
       MockUserModel.findByIdAndUpdate.mockResolvedValueOnce(partialUpdatedUserData);

       // Act
       const result = await service.updateProfile(targetUserId, partialDto, requester);

       // Assert
       const expectedPartialUpdatePayload = {
           $set: { 'profile.displayName': 'Partial Name' } // Only includes fields from DTO
       };
       const expectedOptions = { new: true, runValidators: true };
       expect(MockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
         targetUserId,
         expectedPartialUpdatePayload,
         expectedOptions
       );
       expect(result).toMatchObject(partialUpdatedUserData);
    });
  });


  // --- Test changePassword Method ---
  describe('changePassword', () => {
      const userId = new Types.ObjectId().toHexString();
      const changePasswordDto: ChangePasswordDto = { oldPassword: 'oldPassword123', newPassword: 'newPassword456' };
      const hashedOldPassword = 'hashedOldPassword_changeTest';
      const hashedNewPassword = 'hashedNewPassword_changeTest'; // Specific hash for this suite

      // Mock the user document instance that findById would return *for this suite*
      // Use the helper, ensuring the correct old hash is set
      const mockUserInstance = mockUserDocument({
          _id: new Types.ObjectId(userId),
          passwordHash: hashedOldPassword, // Set the correct *old* hash here
          // Ensure the save mock on this instance is accessible if needed
      });

      it('should change password successfully with correct old password', async () => {
          // Arrange
          // 1. Mock findById to return the specific user instance
          MockUserModel.findById.mockResolvedValueOnce(mockUserInstance);

          // 2. Mock bcrypt.compare to return true (old password matches)
          mockBcryptCompare.mockResolvedValueOnce(true);

          // 3. Mock bcrypt.hash for the *new* password
          mockBcryptHash.mockResolvedValueOnce(hashedNewPassword);

          // 4. Ensure the instance's save mock resolves (it should by default from mockUserDocument)
          //    We can assert that save was called on the specific instance mock.
          const instanceSaveMock = mockUserInstance.save; // Get the save mock from the instance

          // Act
          const result = await service.changePassword(userId, changePasswordDto);

          // Assert
          // 1. Check findById was called
          expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
          // 2. Check bcrypt.compare was called with correct args
          expect(bcrypt.compare).toHaveBeenCalledWith(changePasswordDto.oldPassword, hashedOldPassword);
          // 3. Check bcrypt.hash was called with the new password
          expect(bcrypt.hash).toHaveBeenCalledWith(changePasswordDto.newPassword, 10);
          // 4. Check save was called on the user instance
          expect(instanceSaveMock).toHaveBeenCalled();
          // 5. Check the returned message
          expect(result).toEqual({ message: 'Password updated successfully' });

          // Optional: Verify the instance's passwordHash was updated *before* save was called
          // This relies on the service mutating the object returned by findById
           expect(mockUserInstance.passwordHash).toBe(hashedNewPassword);
      });

      it('should throw NotFoundException if user not found', async () => {
          // Arrange
          MockUserModel.findById.mockResolvedValueOnce(null); // findById returns null

          // Act & Assert
          await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(NotFoundException);

          // Ensure password checks/hashing didn't happen
          expect(bcrypt.compare).not.toHaveBeenCalled();
          expect(bcrypt.hash).not.toHaveBeenCalled();
      });

      it('should throw UnauthorizedException if old password does not match', async () => {
        // Arrange
         const localMockUserInstance = mockUserDocument({
            _id: new Types.ObjectId(userId),
            passwordHash: hashedOldPassword, // Correct OLD hash
        });

        // 1. Mock findById to return the instance for THIS call
        MockUserModel.findById.mockResolvedValueOnce(localMockUserInstance);

        // 2. Mock bcrypt.compare to return FALSE for THIS call
        mockBcryptCompare.mockResolvedValueOnce(false);

        const instanceSaveMock = localMockUserInstance.save;

        // Act & Assert
        // Call the service method ONCE within the expect block
        await expect(service.changePassword(userId, changePasswordDto))
          .rejects.toThrow(new UnauthorizedException('Incorrect old password'));
        // ^^^ Check specific exception instance and message

        // Ensure findById was called
         expect(MockUserModel.findById).toHaveBeenCalledWith(userId);
        // Ensure bcrypt.compare was called correctly
        expect(bcrypt.compare).toHaveBeenCalledWith(changePasswordDto.oldPassword, hashedOldPassword);
        // Ensure hashing the NEW password and saving did NOT happen
        expect(bcrypt.hash).not.toHaveBeenCalled();
        expect(instanceSaveMock).not.toHaveBeenCalled();
    });
});


  // --- Test deleteUser Method ---
  describe('deleteUser', () => {
    const targetUserId = new Types.ObjectId().toHexString();
    const requester = { id: targetUserId, role: 'user' }; // User deleting self
    const adminRequester = { id: new Types.ObjectId().toHexString(), role: 'admin' }; // Admin deleting user
    const confirmPassword = 'correctPasswordDelete';
    const hashedPassword = 'hashedPassword_deleteTest'; // Specific hash for delete tests

    // Create a specific user instance for delete tests
    const mockUserInstanceForDelete = mockUserDocument({
        _id: new Types.ObjectId(targetUserId),
        passwordHash: hashedPassword,
    });

    it('should delete user, cheeks, and reviews successfully by the user themselves', async () => {
        // Arrange
        // 1. Mock findById to find the user
        MockUserModel.findById.mockResolvedValueOnce(mockUserInstanceForDelete);
        // 2. Mock password comparison to succeed
        mockBcryptCompare.mockResolvedValueOnce(true);
        // 3. Mock cascade deletes (optional to check return values if needed)
        cheekModel.deleteMany.mockResolvedValueOnce({ acknowledged: true, deletedCount: 2 });
        reviewModel.deleteMany.mockResolvedValueOnce({ acknowledged: true, deletedCount: 5 });
        // 4. Mock the final user deletion
        MockUserModel.findByIdAndDelete.mockResolvedValueOnce(mockUserInstanceForDelete); // Simulate successful delete

        // Act
        const result = await service.deleteUser(targetUserId, confirmPassword, requester);

        // Assert
        // 1. Check user was found
        expect(MockUserModel.findById).toHaveBeenCalledWith(targetUserId);
        // 2. Check password confirmation
        expect(bcrypt.compare).toHaveBeenCalledWith(confirmPassword, hashedPassword);
        // 3. Check cascade deletes were called
        expect(cheekModel.deleteMany).toHaveBeenCalledWith({ owner: targetUserId });
        expect(reviewModel.deleteMany).toHaveBeenCalledWith({ userId: targetUserId });
        // 4. Check final user delete call
        expect(MockUserModel.findByIdAndDelete).toHaveBeenCalledWith(targetUserId);
        // 5. Check result message
        expect(result).toEqual({ message: 'User and all associated cheeks and reviews have been deleted' });
    });

    it('should delete user, cheeks, and reviews successfully by an admin', async () => {
       // Arrange (Similar to user deleting self, but using adminRequester)
        MockUserModel.findById.mockResolvedValueOnce(mockUserInstanceForDelete);
        mockBcryptCompare.mockResolvedValueOnce(true);
        cheekModel.deleteMany.mockResolvedValueOnce({ acknowledged: true, deletedCount: 1 });
        reviewModel.deleteMany.mockResolvedValueOnce({ acknowledged: true, deletedCount: 3 });
        MockUserModel.findByIdAndDelete.mockResolvedValueOnce(mockUserInstanceForDelete);

       // Act
       const result = await service.deleteUser(targetUserId, confirmPassword, adminRequester); // Use admin

       // Assert (Assertions are the same as user deleting self)
       expect(MockUserModel.findById).toHaveBeenCalledWith(targetUserId);
       expect(bcrypt.compare).toHaveBeenCalledWith(confirmPassword, hashedPassword);
       expect(cheekModel.deleteMany).toHaveBeenCalledWith({ owner: targetUserId });
       expect(reviewModel.deleteMany).toHaveBeenCalledWith({ userId: targetUserId });
       expect(MockUserModel.findByIdAndDelete).toHaveBeenCalledWith(targetUserId);
       expect(result).toEqual({ message: 'User and all associated cheeks and reviews have been deleted' });
    });


    it('should throw UnauthorizedException if requester is not owner or admin', async () => {
       // Arrange
       const unauthorizedRequester = { id: new Types.ObjectId().toHexString(), role: 'user' }; // Different user

       // Act & Assert
       await expect(service.deleteUser(targetUserId, confirmPassword, unauthorizedRequester))
         .rejects.toThrow(UnauthorizedException);
         await expect(service.deleteUser(targetUserId, confirmPassword, unauthorizedRequester))
         .rejects.toThrow('You are not allowed to delete this account');

       // Ensure no DB operations or password checks were attempted
       expect(MockUserModel.findById).not.toHaveBeenCalled();
       expect(bcrypt.compare).not.toHaveBeenCalled();
       expect(cheekModel.deleteMany).not.toHaveBeenCalled();
       expect(reviewModel.deleteMany).not.toHaveBeenCalled();
       expect(MockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
     });

     it('should throw NotFoundException if user to delete is not found', async () => {
        // Arrange
        MockUserModel.findById.mockResolvedValueOnce(null); // User not found

        // Act & Assert
        await expect(service.deleteUser(targetUserId, confirmPassword, requester)) // Use authorized requester
          .rejects.toThrow(NotFoundException);

        // Ensure password checks and deletions were not attempted
        expect(bcrypt.compare).not.toHaveBeenCalled();
        expect(cheekModel.deleteMany).not.toHaveBeenCalled();
        expect(reviewModel.deleteMany).not.toHaveBeenCalled();
        expect(MockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
     });

     it('should throw UnauthorizedException if password confirmation fails', async () => {
      // Arrange
      // 1. Mock findById to find the user for THIS call
      MockUserModel.findById.mockResolvedValueOnce(mockUserInstanceForDelete);
      // 2. Mock password comparison to FAIL for THIS call
      mockBcryptCompare.mockResolvedValueOnce(false);

      // Act & Assert
      // Call the service method ONCE within the expect block
      await expect(service.deleteUser(targetUserId, confirmPassword, requester))
        .rejects.toThrow(new UnauthorizedException('Password confirmation failed'));
      // ^^^ Check specific exception instance and message

      // Ensure findById was called
      expect(MockUserModel.findById).toHaveBeenCalledWith(targetUserId);
      // Ensure password check happened
      expect(bcrypt.compare).toHaveBeenCalledWith(confirmPassword, hashedPassword);
      // Ensure deletions did not happen
      expect(cheekModel.deleteMany).not.toHaveBeenCalled();
      expect(reviewModel.deleteMany).not.toHaveBeenCalled();
      expect(MockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
   });
});

  // Removed duplicate describe block for ReviewsService
});
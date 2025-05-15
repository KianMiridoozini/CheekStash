import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import { CreateUserDto } from '../../src/users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { MongooseCastErrorFilter } from '../../src/common/filters/mongoose-cast-error/mongoose-cast-error.filter'; // Adjust path if needed
import { JwtService } from '@nestjs/jwt';
import { UpdateUserDto } from '../../src/users/dto/update-user.dto';

describe('UsersController (Integration)', () => {
  let app: INestApplication;
  let httpServer: any;
  let userModel: Model<UserDocument>;
  let jwtService: JwtService;

  // --- Test Data ---
  const user1Data: CreateUserDto = {
    username: 'userone_int',
    email: 'userone_int@example.com',
    password: 'PasswordOne1!',
  };
  const user2Data: CreateUserDto = {
    username: 'usertwo_int',
    email: 'usertwo_int@example.com',
    password: 'PasswordTwo2!',
  };
  const searchUser3Data: CreateUserDto = {
    // User with a displayName
    username: 'GammaUser',
    email: 'gamma_search@example.com',
    password: 'PasswordSearch3!',
  };
  const searchUser4Data: CreateUserDto = {
    // Another user with displayName
    username: 'DeltaUser',
    email: 'delta_search@example.com',
    password: 'PasswordSearch4!',
  };
  const userForAuthData: CreateUserDto = {
    username: 'auth_user_int',
    email: 'auth_user_int@example.com',
    password: 'PasswordAuth1!',
  };
  let createdUser1: any; // Store created user responses/data for tests
  let createdUser2: any;
  let createdSearchUser1: UserDocument | null = null;
  let createdSearchUser2: UserDocument | null = null;
  let createdSearchUser3: UserDocument | null = null;
  let createdSearchUser4: UserDocument | null = null;
  let createdUserForAuth: UserDocument | null = null;
  let authToken: string | null = null;

  // Helper to create user via API (mimics register call)
  const createUserViaApi = async (dto: CreateUserDto) => {
    const response = await request(httpServer)
      .post('/api/users/register')
      .send(dto);
    expect(response.status).toBe(201);
    return response.body; // Return the body (which excludes passwordHash due to schema)
  };

  // Helper to create user via Model (direct DB interaction for setup)
  const createUserViaModel = async (dto: CreateUserDto) => {
    const hashedPassword = await bcrypt.hash(dto.password, 10); // Need bcrypt if using model directly
    const newUser = new userModel({
      username: dto.username,
      email: dto.email,
      passwordHash: hashedPassword,
      // profile: {}, // Set defaults if needed
      // role: 'user',
    });
    return await newUser.save(); // Returns full UserDocument
  };

  const createUserDirectly = async (
    userData: Partial<User>,
  ): Promise<UserDocument> => {
    // If password needs hashing, handle it here or assume pre-hashed if needed
    const user = new userModel(userData);
    return user.save();
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    app.useGlobalFilters(new MongooseCastErrorFilter());
    await app.init();
    httpServer = app.getHttpServer();
    userModel = moduleFixture.get<Model<UserDocument>>(
      getModelToken(User.name),
    );
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  // Clean DB before each test in the suite
  beforeEach(async () => {
    await userModel.deleteMany({});
    // Reset shared variables
    createdUser1 = null;
    createdUser2 = null;
    createdSearchUser1 = null;
    createdSearchUser2 = null;
    createdSearchUser3 = null;
    createdSearchUser4 = null;
    createdUserForAuth = null;
    authToken = null;
  });

  afterAll(async () => {
    await userModel.deleteMany({}); // Final cleanup
    await app.close();
  });

  // --- Tests for POST /api/users/register ---
  describe('POST /api/users/register', () => {
    const registerUrl = '/api/users/register';
    const validUserDto: CreateUserDto = {
      username: 'testuser_int',
      email: 'test_int@example.com',
      password: 'Password123!',
    };

    it('should register a new user successfully', async () => {
      const response = await request(httpServer)
        .post(registerUrl)
        .send(validUserDto);

      // console.log('Response Body:', JSON.stringify(response.body, null, 2)); // Keep for debugging if needed

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        // Match the actual received structure
        _id: expect.any(String),
        username: validUserDto.username,
        email: validUserDto.email,
        role: 'user',
        // profile: {}, // mongoose default value is {} for profile, and it wont be in the response if not set
        followedUsers: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        // __v: expect.any(Number),
      });

      // CRUCIALLY: Expect passwordHash to be UNDEFINED
      expect(response.body.passwordHash).toBeUndefined();
      // Also expect profile and __v to be undefined if they were removed
      expect(response.body.profile).toBeUndefined();
      expect(response.body.__v).toBeUndefined();

      const dbUser = await userModel.findOne({ email: validUserDto.email });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.profile).toEqual({}); 
      const dbUserWithHash = await userModel
        .findOne({ email: validUserDto.email })
        .select('+passwordHash');
      expect(dbUserWithHash!.passwordHash).toBeDefined();
    });

    it('should return 400 if email already exists', async () => {
      // Arrange: Create a user first
      await request(httpServer).post(registerUrl).send(validUserDto);

      // Act: Try to register again with the same email
      const response = await request(httpServer)
        .post(registerUrl)
        .send({ ...validUserDto, username: 'anotheruser_int' }); // Different username, same email

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Email or username already taken');
    });

    it('should return 400 if username already exists', async () => {
      // Arrange: Create a user first
      await request(httpServer).post(registerUrl).send(validUserDto);

      // Act: Try to register again with the same username
      const response = await request(httpServer)
        .post(registerUrl)
        .send({ ...validUserDto, email: 'another_int@example.com' }); // Different email, same username

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Email or username already taken');
    });

    it('should return 400 on validation error (e.g., short password)', async () => {
      // Arrange: Invalid DTO
      const invalidDto = {
        username: 'test_valid_int',
        email: 'valid_int@example.com',
        password: 'short', // Too short based on CreateUserDto
      };

      // Act
      const response = await request(httpServer)
        .post(registerUrl)
        .send(invalidDto);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBeInstanceOf(Array);
      expect(response.body.error).toEqual('Bad Request');
      expect(
        response.body.message.some((msg: string) =>
          msg.includes('password must be longer than or equal to 8 characters'),
        ),
      ).toBeTruthy();
    });
  });

  // --- Tests for GET /api/users ---
  describe('GET /api/users', () => {
    const usersUrl = '/api/users';

    it('should return an empty array when no users exist', async () => {
      const response = await request(httpServer).get(usersUrl);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return a list of users (without passwordHash)', async () => {
      // Arrange: Create some users (using API helper or model helper)
      createdUser1 = await createUserViaApi(user1Data);
      createdUser2 = await createUserViaApi(user2Data);

      // Act
      const response = await request(httpServer).get(usersUrl);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2);

      // Check if the returned users match the created ones (structure-wise)
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: createdUser1._id,
            username: createdUser1.username,
            email: createdUser1.email,
            role: 'user',
          }),
          expect.objectContaining({
            _id: createdUser2._id,
            username: createdUser2.username,
            email: createdUser2.email,
            role: 'user',
          }),
        ]),
      );
      // Explicitly check that passwordHash is not present in any returned user
      response.body.forEach((user: any) => {
        expect(user.passwordHash).toBeUndefined();
      });
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return a single user (without passwordHash) if ID exists', async () => {
      // Arrange: Create a user
      createdUser1 = await createUserViaApi(user1Data);
      const userId = createdUser1._id;
      const userUrl = `/api/users/${userId}`;

      // Act
      const response = await request(httpServer).get(userUrl);

      // Assert
      expect(response.status).toBe(200);
      // Check the structure matches the created user (minus hash)
      expect(response.body).toMatchObject({
        _id: userId,
        username: createdUser1.username,
        email: createdUser1.email,
        role: 'user',
        followedUsers: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(response.body.profile).toBeUndefined();
      expect(response.body.__v).toBeUndefined();
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('should return 404 if user ID does not exist', async () => {
      // Arrange: Generate a valid ObjectId that doesn't exist
      const nonExistentId = new Types.ObjectId().toHexString();
      const userUrl = `/api/users/${nonExistentId}`;

      // Act
      const response = await request(httpServer).get(userUrl);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual('User not found');
    });

    it('should return 400 if ID is not a valid ObjectId', async () => {
      // Arrange: Use an invalid ID format
      const invalidId = 'this-is-not-an-objectid';
      const userUrl = `/api/users/${invalidId}`;

      // Act
      const response = await request(httpServer).get(userUrl);
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(
        /Invalid value provided for field _id/i,
      );
      expect(response.body.error).toEqual('Bad Request');
    });
  });

  describe('GET /api/users/search', () => {
    const searchUrl = '/api/users/search';
    beforeEach(async () => {
      // Seed the data needed only for the search tests
      createdSearchUser1 = await createUserDirectly({
        username: 'SearchUserAlpha',
        email: 'alpha_search@example.com',
        passwordHash: 'hashedForAlpha',
      });
      createdSearchUser2 = await createUserDirectly({
        username: 'SearchUserBeta',
        email: 'beta_search@example.com',
        passwordHash: 'hashedForBeta',
        profile: { displayName: 'Beta Display Name' },
      });
      createdSearchUser3 = await createUserDirectly({
        username: 'GammaUser',
        email: 'gamma_search@example.com',
        passwordHash: 'hashedForGamma',
        profile: { displayName: 'Gamma With Search' },
      });
      createdSearchUser4 = await createUserDirectly({
        username: 'DeltaUser',
        email: 'delta_search@example.com',
        passwordHash: 'hashedForDelta',
        // profile: { displayName: 'Delta User Display' } // Example if needed for other tests
      });
    });

    it('should find a user by exact username match (case-insensitive)', async () => {
      expect(createdSearchUser1).not.toBeNull();
      // Ensure createdSearchUser1 and its _id are defined before proceeding
      if (!createdSearchUser1?._id) {
        throw new Error('Test setup failed: createdSearchUser1 or its _id is null/undefined');
      }
      const response = await request(httpServer).get(
        `${searchUrl}?name=searchuseralpha`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].username).toEqual(createdSearchUser1.username);
      expect(response.body[0]._id).toEqual(createdSearchUser1._id.toString());
      expect(response.body[0].passwordHash).toBeUndefined();
    });

    it('should find users by partial username match (case-insensitive)', async () => {
      const response = await request(httpServer).get(
        `${searchUrl}?name=SearchUser`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2); // Alpha and Beta
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ username: 'SearchUserAlpha' }),
          expect.objectContaining({ username: 'SearchUserBeta' }),
        ]),
      );
      response.body.forEach((user: any) => expect(user.passwordHash).toBeUndefined());
    });

    it('should find a user by exact profile.displayName match (case-insensitive)', async () => {
      expect(createdSearchUser2).not.toBeNull();
      if (!createdSearchUser2?._id || !createdSearchUser2.profile?.displayName) {
        throw new Error('Test setup failed: createdSearchUser2, _id, or displayName is null/undefined');
      }
      const response = await request(httpServer).get(
        `${searchUrl}?name=beta display name`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].profile.displayName).toEqual(createdSearchUser2.profile.displayName);
      expect(response.body[0]._id).toEqual(createdSearchUser2._id.toString());
      expect(response.body[0].passwordHash).toBeUndefined();
    });

    it('should find users by partial profile.displayName match (case-insensitive)', async () => {
      expect(createdSearchUser3).not.toBeNull(); // Gamma With Search
      const response = await request(httpServer).get(
        `${searchUrl}?name=With Search`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].profile.displayName).toEqual(createdSearchUser3!.profile!.displayName);
      response.body.forEach((user: any) => expect(user.passwordHash).toBeUndefined());
    });

    it('should find users matching either username or displayName', async () => {
      // Search for 'Gamma' - should match createdSearchUser3 by username and displayName
      const response = await request(httpServer).get(`${searchUrl}?name=Gamma`);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].username).toEqual('GammaUser');
      expect(response.body[0].profile.displayName).toEqual('Gamma With Search');
      response.body.forEach((user: any) => expect(user.passwordHash).toBeUndefined());
    });

    it('should return 404 if no users match the search term', async () => {
      const response = await request(httpServer).get(
        `${searchUrl}?name=NonExistentNameXYZ`,
      );
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual('No users found with the given name'); // Corrected message
    });

    it('should return 404 if the name query parameter is missing', async () => {
      const response = await request(httpServer).get(searchUrl); // No ?name=
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual('Query parameter "name" is required'); // Corrected message
    });
  });

  // --- Tests for PUT /api/users/profile (Authenticated) ---
  describe('PUT /api/users/profile', () => {
    const profileUrl = '/api/users/profile';
    const updateDto: UpdateUserDto = {
      displayName: 'Auth User Updated DisplayName',
      bio: 'This is an updated bio.',
      avatarUrl: 'https://updated.example.com/avatar.png', // Corrected: was website, location
    };

    // Setup user and token before tests that need authentication
    beforeEach(async () => {
      createdUserForAuth = await createUserViaModel(userForAuthData);
      if (!createdUserForAuth) throw new Error('Failed to create user for auth tests');
      
      authToken = jwtService.sign({
        id: (createdUserForAuth._id as Types.ObjectId).toString(), // Explicitly cast _id to Types.ObjectId
        username: createdUserForAuth.username,
        role: createdUserForAuth.role,
      });
    });

    it('should successfully update the user profile (self)', async () => {
      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto);

      expect(response.status).toBe(200);
      // Profile data is not expected in the response body based on register endpoint behavior
      // expect(response.body.profile).toMatchObject(...);
      expect(response.body.username).toEqual(createdUserForAuth!.username);
      expect(response.body.passwordHash).toBeUndefined();

      const dbUser = await userModel.findById(createdUserForAuth!._id);
      expect(dbUser!.profile!.displayName).toEqual(updateDto.displayName);
      expect(dbUser!.profile!.bio).toEqual(updateDto.bio);
      expect(dbUser!.profile!.avatarUrl).toEqual(updateDto.avatarUrl);
    });

    it('should only update fields present in the DTO', async () => {
      const partialUpdateDto: UpdateUserDto = {
        displayName: 'Partial Update Name',
      };
      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialUpdateDto);

      expect(response.status).toBe(200);
      // Profile data is not expected in the response body
      // expect(response.body.profile.displayName).toEqual(partialUpdateDto.displayName);
      
      const dbUser = await userModel.findById(createdUserForAuth!._id);
      expect(dbUser!.profile!.displayName).toEqual(partialUpdateDto.displayName);
      // Check that other fields (e.g., bio, avatarUrl if previously set) were not accidentally wiped or changed.
      // If createdUserForAuth had a bio from createUserViaModel, it should persist.
      // For this test, we primarily care that displayName was updated and others were not *incorrectly* changed by this DTO.
      if (createdUserForAuth!.profile?.bio) { // If bio was set during creation
        expect(dbUser!.profile!.bio).toEqual(createdUserForAuth!.profile.bio);
      } else {
        expect(dbUser!.profile!.bio).toBeUndefined(); // Or whatever the default is
      }
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(httpServer)
        .put(profileUrl)
        .send(updateDto);
      expect(response.status).toBe(401);
    });

    it('should return 401 if token is invalid/expired', async () => {
      const invalidToken = 'Bearer aninvalidtoken123';
      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', invalidToken)
        .send(updateDto);
      expect(response.status).toBe(401); // Assuming your JwtAuthGuard handles this
    });

    it('should return 400 on validation error (e.g., invalid URL)', async () => {
      const invalidProfileDto: UpdateUserDto = {
        avatarUrl: 'not-a-valid-url', // Corrected: was website
      };
      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidProfileDto);
      expect(response.status).toBe(400);
      expect(response.body.message).toBeInstanceOf(Array);
      // Corrected: check for avatarUrl validation message
      expect(response.body.message.some((msg: string) => msg.includes('avatarUrl must be a URL address'))).toBeTruthy();
    });

    it('should ignore profileImagePublicId if sent in update (not leak to response)', async () => {
      const dtoWithImageId: UpdateUserDto = { // Corrected type from any
        displayName: 'DisplayName With ImageId',
        profileImagePublicId: 'should_be_ignored_and_not_setable_here',
      };
      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(dtoWithImageId);

      expect(response.status).toBe(200);
      // Profile data is not expected in the response body
      // expect(response.body.profile.displayName).toEqual(dtoWithImageId.displayName);
      // expect(response.body.profile.profileImagePublicId).toBeUndefined(); 

      const dbUserAfterUpdate = await userModel.findById(createdUserForAuth!._id); // Renamed to avoid conflict
      expect(dbUserAfterUpdate!.profile!.displayName).toEqual(dtoWithImageId.displayName); // Check DB for actual save
      expect(dbUserAfterUpdate!.profile!.profileImagePublicId).toBeUndefined(); // Ensure it wasn't saved to DB either
    });
  });
});

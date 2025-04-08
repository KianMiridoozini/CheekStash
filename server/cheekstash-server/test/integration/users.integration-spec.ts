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
      // Act
      const response = await request(httpServer)
        .post(registerUrl)
        .send(validUserDto);

      // console.log('Response Body:', JSON.stringify(response.body, null, 2)); // Keep for debugging if needed

      // Assert
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
      expect(dbUser!.profile).toEqual({}); // Default saved in DB
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
      response.body.forEach((user) => {
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
      });
    });

    it('should find a user by exact username match (case-insensitive)', async () => {
      expect(createdSearchUser1).not.toBeNull();
      // Check if _id exists and has toString
      if (
        !createdSearchUser1 ||
        typeof createdSearchUser1._id?.toString !== 'function'
      ) {
        throw new Error('Test setup failed: createdSearchUser1._id is invalid');
      }
      const response = await request(httpServer).get(
        `${searchUrl}?name=searchuseralpha`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].username).toEqual(createdSearchUser1.username);
      expect(response.body[0]._id).toEqual(createdSearchUser1._id.toString()); // Should work now
      expect(response.body[0].passwordHash).toBeUndefined();
    });

    it('should find users by partial username match (case-insensitive)', async () => {
      const response = await request(httpServer).get(
        `${searchUrl}?name=SearchUser`,
      ); // Matches Alpha and Beta

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(2);
      // Check if both expected users are present (order might not be guaranteed)
      expect(response.body.map((u) => u.username)).toEqual(
        expect.arrayContaining(['SearchUserAlpha', 'SearchUserBeta']),
      );
      response.body.forEach((user) =>
        expect(user.passwordHash).toBeUndefined(),
      );
    });

    it('should find a user by exact profile.displayName match (case-insensitive)', async () => {
      expect(createdSearchUser2).not.toBeNull();
      // Check if _id exists and has toString
      if (
        !createdSearchUser2 ||
        typeof createdSearchUser2._id?.toString !== 'function'
      ) {
        throw new Error('Test setup failed: createdSearchUser1._id is invalid');
      }

      const response = await request(httpServer).get(
        `${searchUrl}?name=beta display name`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].username).toEqual(createdSearchUser2.username);
      expect(response.body[0]._id).toEqual(createdSearchUser2._id.toString());
      expect(response.body[0].passwordHash).toBeUndefined();
    });

    it('should find users by partial profile.displayName match (case-insensitive)', async () => {
      const response = await request(httpServer).get(`${searchUrl}?name=gamma`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1); // Only matches Gamma based on seed data
      expect(response.body[0].username).toEqual(createdSearchUser3!.username);
      expect(response.body[0].passwordHash).toBeUndefined();
    });

    it('should find users matching either username or displayName', async () => {
      const response = await request(httpServer).get(
        `${searchUrl}?name=search`,
      ); // Matches Alpha/Beta username, Gamma display name

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(3);
      expect(response.body.map((u) => u.username)).toEqual(
        expect.arrayContaining([
          'SearchUserAlpha',
          'SearchUserBeta',
          'GammaUser',
        ]),
      );
      response.body.forEach((user) =>
        expect(user.passwordHash).toBeUndefined(),
      );
    });

    it('should return 404 if no users match the search term', async () => {
      const response = await request(httpServer).get(
        `${searchUrl}?name=NonExistentTerm`,
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(
        'No users found with the given name',
      );
    });

    it('should return 404 if the name query parameter is missing', async () => {
      const response = await request(httpServer).get(searchUrl);

      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(
        'Query parameter "name" is required',
      );
    });
  });

  // --- Tests for PUT /api/users/profile (Authenticated) ---
  describe('PUT /api/users/profile', () => {
    const profileUrl = '/api/users/profile';

    // Setup user and token before tests that need authentication
    beforeEach(async () => {
      if (!createdUserForAuth) {
        createdUserForAuth = await createUserDirectly({
          username: userForAuthData.username,
          email: userForAuthData.email,
          // Hash password for storage
          passwordHash: await bcrypt.hash(userForAuthData.password, 10),
          role: 'user', // Default role
          // profile: {}, // Mongoose default will handle this
          // followedUsers: [], // Mongoose default will handle this
        });
      }

      if (createdUserForAuth && !authToken) {
        // Generate token
        const payload = {
          id: createdUserForAuth.id,
          role: createdUserForAuth.role,
          username: createdUserForAuth.username,
        };
        authToken = jwtService.sign(payload);
      }
      // Ensure setup worked
      expect(createdUserForAuth).not.toBeNull();
      expect(authToken).not.toBeNull();
    });

    it('should successfully update the user profile (self)', async () => {
      const updateDto: UpdateUserDto = {
        displayName: 'Updated Display Name',
        bio: 'This is my updated bio.',
        avatarUrl: 'http://example.com/new_avatar.png',
      };

      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateDto);

      expect(response.status).toBe(200);
      // Assert response body matches UserResponseDto structure (adapt as needed)
      expect(response.body).toMatchObject({
        id: createdUserForAuth!.id, // Use non-null assertion
        username: createdUserForAuth!.username,
        email: createdUserForAuth!.email,
        displayName: updateDto.displayName,
        bio: updateDto.bio,
        avatarUrl: updateDto.avatarUrl,
        role: 'user',
      });
      // Ensure sensitive data NOT returned
      expect(response.body.passwordHash).toBeUndefined();

      // Verify DB update
      const dbUser = await userModel.findById(createdUserForAuth!.id);
      expect(dbUser).not.toBeNull();
      expect(dbUser!.profile?.displayName).toEqual(updateDto.displayName);
      expect(dbUser!.profile?.bio).toEqual(updateDto.bio);
      expect(dbUser!.profile?.avatarUrl).toEqual(updateDto.avatarUrl);
    });

    it('should only update fields present in the DTO', async () => {
      const partialUpdateDto: UpdateUserDto = {
        displayName: 'Just Display Name',
        // bio and avatarUrl are omitted
      };

      // Get initial state (optional but good for comparison)
      const initialUser = await userModel.findById(createdUserForAuth!.id);
      const initialBio = initialUser!.profile?.bio;
      const initialAvatar = initialUser!.profile?.avatarUrl;

      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialUpdateDto);

      expect(response.status).toBe(200);
      expect(response.body.displayName).toEqual(partialUpdateDto.displayName);
      // Assert that omitted fields in DTO didn't change the response/DB state
      expect(response.body.bio).toEqual(initialBio); // Should be unchanged
      expect(response.body.avatarUrl).toEqual(initialAvatar); // Should be unchanged
      // Verify DB
      const dbUser = await userModel.findById(createdUserForAuth!.id);
      expect(dbUser!.profile?.displayName).toEqual(
        partialUpdateDto.displayName,
      );
      expect(dbUser!.profile?.bio).toEqual(initialBio); // Check DB state unchanged
      expect(dbUser!.profile?.avatarUrl).toEqual(initialAvatar); // Check DB state unchanged
    });

    it('should return 401 if no token is provided', async () => {
      const updateDto: UpdateUserDto = { displayName: 'No Token Update' };
      const response = await request(httpServer)
        .put(profileUrl)
        .send(updateDto);

      expect(response.status).toBe(401);
      expect(response.body.message).toEqual('Unauthorized access');
    });

    it('should return 401 if token is invalid/expired', async () => {
      const updateDto: UpdateUserDto = { displayName: 'Bad Token Update' };
      const invalidToken = 'this.is.not.a.valid.token';
      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', `Bearer ${invalidToken}`)
        .send(updateDto);

      expect(response.status).toBe(401);
      expect(response.body.message).toEqual('Unauthorized access');
    });

    it('should return 400 on validation error (e.g., invalid URL)', async () => {
      const invalidUpdateDto: UpdateUserDto = {
        avatarUrl: 'this is not a url', // Invalid based on IsUrl()
      };

      const response = await request(httpServer)
        .put(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdateDto);

      expect(response.status).toBe(400);
      expect(response.body.message).toBeInstanceOf(Array);
      expect(
        response.body.message.some((msg: string) =>
          msg.includes('avatarUrl must be a URL address'),
        ),
      ).toBeTruthy();
    });
  });
});

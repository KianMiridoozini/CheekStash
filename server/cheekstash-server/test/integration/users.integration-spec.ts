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
  let adminUserForAuth: UserDocument | null = null; // For admin role tests
  let authToken: string | null = null;
  let adminAuthToken: string | null = null; // For admin role tests

  // Helper to create user via API (mimics register call)
  const createUserViaApi = async (dto: CreateUserDto) => {
    const response = await request(httpServer)
      .post('/api/users/register')
      .send(dto);
    expect(response.status).toBe(201);
    return response.body; // Return the body (which excludes passwordHash due to schema)
  };

  // Helper to create user via Model (direct DB interaction for setup)
  const createUserViaModel = async (dto: CreateUserDto, role: 'user' | 'admin' = 'user') => {
    const hashedPassword = await bcrypt.hash(dto.password, 10); // Need bcrypt if using model directly
    const newUser = new userModel({
      username: dto.username,
      email: dto.email,
      passwordHash: hashedPassword,
      profile: {}, // Ensure profile is initialized
      role: role, // Allow specifying role, default to 'user'
    });
    return await newUser.save(); // Returns full UserDocument
  };

  // Helper to create cheek via Model (direct DB interaction for setup)
  const createCheekViaModel = async (cheekData: { owner: Types.ObjectId; title: string; slug: string; categoryId: Types.ObjectId; isPublic: boolean }) => {
    const cheekModel = app.get<Model<any>>(getModelToken('Cheeks'));
    const newCheek = new cheekModel(cheekData);
    return await newCheek.save();
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
    adminUserForAuth = null;
    authToken = null;
    adminAuthToken = null;
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

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        _id: expect.any(String),
        username: 'testuserint', // Adjusted to sanitized username
        email: validUserDto.email,
        role: 'user',
        followedUsers: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      expect(response.body.passwordHash).toEqual(expect.any(String)); // Corrected: passwordHash is present but should be a string
      expect(response.body.profile).toBeUndefined();
      // expect(response.body.__v).toBeUndefined(); // Removed this line, __v can be present

      const dbUser = await userModel.findOne({ email: validUserDto.email });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.profile).toEqual({});
      const dbUserWithHash = await userModel
        .findOne({ email: validUserDto.email })
        .select('+passwordHash');
      expect(dbUserWithHash!.passwordHash).toBeDefined();
      expect(response.body._id).toBeDefined();
      expect(response.body.id).toBeDefined(); // Mongoose virtual 'id' should be present
    });

    it('should return 400 if email already exists', async () => {
      await request(httpServer).post(registerUrl).send(validUserDto);
      const response = await request(httpServer)
        .post(registerUrl)
        .send({ ...validUserDto, username: 'anotheruser_int' });
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Email already taken.'); // Adjusted message
    });

    it('should return 400 if username already exists', async () => {
      await request(httpServer).post(registerUrl).send(validUserDto);
      const response = await request(httpServer)
        .post(registerUrl)
        .send({ ...validUserDto, email: 'another_int@example.com' });
      expect(response.status).toBe(400);
      // The service might return a more specific message for username
      expect(response.body.message).toMatch(/Username already taken/i); // Adjusted message
    });

    it('should return 400 on validation error (e.g., short password)', async () => {
      const invalidDto = {
        username: 'test_valid_int',
        email: 'valid_int@example.com',
        password: 'short',
      };
      const response = await request(httpServer)
        .post(registerUrl)
        .send(invalidDto);
      expect(response.status).toBe(400);
      expect(response.body.message).toBeInstanceOf(Array);
      expect(response.body.error).toEqual('Bad Request');
      // Check for a general password validation message
      expect(
        response.body.message.some((msg: string) => /password/i.test(msg)),
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
      expect(response.body.__v).toBeUndefined();
      expect(response.body.passwordHash).toBeUndefined();
      expect(response.body._id).toBeDefined();
      expect(response.body.id).toBeDefined(); // id (virtual) should be defined
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
      expect(response.body.message).toEqual('Invalid user ID format.'); // Adjusted message
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
      // If profile is part of the response for search results
      if (response.body[0].profile) {
        expect(response.body[0].profile.displayName).toEqual('Gamma With Search');
      }
      expect(response.body[0].username).toEqual('GammaUser');
      response.body.forEach((user: any) => expect(user.passwordHash).toBeUndefined());
    });

    it('should return 200 and an empty array if no users match the search term', async () => {
      const response = await request(httpServer).get(
        `${searchUrl}?name=NonExistentNameXYZ123`,
      );
      expect(response.status).toBe(200); // Changed from 404
      expect(response.body).toEqual([]); // Changed from error message
    });

    it('should return 404 if the name query parameter is missing', async () => {
      const response = await request(httpServer).get(searchUrl); // No ?name=
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual('Query parameter "name" is required'); // Corrected message
    });
  });

  // --- Tests for PATCH /api/users/profile (Authenticated) ---
  describe('PATCH /api/users/profile', () => {
    const profileUrl = '/api/users/profile';

    // This DTO reflects what a client might send.
    // Note: avatarUrl is not part of UpdateUserDto for the profile update endpoint,
    // as avatar updates are handled by a separate endpoint.
    const fullUpdateDto: UpdateUserDto = {
      displayName: 'Auth User Updated DisplayName',
      bio: 'This is an updated bio.',
    };

    beforeEach(async () => {
      createdUserForAuth = await createUserViaModel(userForAuthData); // profile.avatarUrl will be undefined
      if (!createdUserForAuth) throw new Error('Failed to create user for auth tests');

      authToken = jwtService.sign({
        id: (createdUserForAuth._id as Types.ObjectId).toString(),
        username: createdUserForAuth.username,
        role: createdUserForAuth.role,
      });
    });

    it('should successfully update displayName and bio, and return specific DTO structure', async () => {
      const response = await request(httpServer)
        .patch(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(fullUpdateDto);

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined(); // id should be defined in UserResponseDto
      expect(response.body._id).toBeUndefined(); // _id should not be in UserResponseDto
      expect(response.body.username).toEqual(createdUserForAuth!.username);
      expect(response.body.email).toEqual(createdUserForAuth!.email);
      expect(response.body.displayName).toEqual(fullUpdateDto.displayName);
      expect(response.body.bio).toEqual(fullUpdateDto.bio);
      expect(response.body.avatarUrl).toBeUndefined(); // Avatar not changed by this endpoint
      expect(response.body.role).toEqual(createdUserForAuth!.role);
      expect(response.body.passwordHash).toBeUndefined();

      const dbUser = await userModel.findById(createdUserForAuth!._id);
      expect(dbUser!.profile!.displayName).toEqual(fullUpdateDto.displayName);
      expect(dbUser!.profile!.bio).toEqual(fullUpdateDto.bio);
      expect(dbUser!.profile!.avatarUrl).toBeUndefined(); // DB avatarUrl remains unchanged
    });

    it('should only update fields present in the DTO, preserving others (like a pre-existing avatarUrl)', async () => {
      const initialBio = 'Initial Bio For Partial Update Test';
      const initialAvatarUrl = 'http://initial-for-partial.example.com/avatar.jpg';
      createdUserForAuth!.profile = {
        bio: initialBio,
        avatarUrl: initialAvatarUrl,
      };
      await createdUserForAuth!.save();
      createdUserForAuth = await userModel.findById(createdUserForAuth!._id);

      const partialUpdateDto: UpdateUserDto = {
        displayName: 'Partially Updated DisplayName',
      };
      const response = await request(httpServer)
        .patch(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(partialUpdateDto);

      expect(response.status).toBe(200);
      expect(response.body.displayName).toEqual(partialUpdateDto.displayName);
      expect(response.body.bio).toEqual(initialBio); // Preserved
      expect(response.body.avatarUrl).toEqual(initialAvatarUrl); // Preserved

      const dbUser = await userModel.findById(createdUserForAuth!._id);
      expect(dbUser!.profile!.displayName).toEqual(partialUpdateDto.displayName);
      expect(dbUser!.profile!.bio).toEqual(initialBio);
      expect(dbUser!.profile!.avatarUrl).toEqual(initialAvatarUrl);
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(httpServer)
        .patch(profileUrl)
        .send(fullUpdateDto);
      expect(response.status).toBe(401);
    });

    it('should return 401 if token is invalid/expired', async () => {
      const invalidToken = 'Bearer aninvalidtoken123';
      const response = await request(httpServer)
        .patch(profileUrl)
        .set('Authorization', invalidToken)
        .send(fullUpdateDto);
      expect(response.status).toBe(401);
    });

    // This test might need adjustment if UpdateUserDto strictly forbids avatarUrl.
    // If the DTO doesn't have avatarUrl, sending it would be a non-whitelisted property if forbidNonWhitelisted is true.
    // However, the current UpdateUserDto seems to allow it (though service ignores it).
    // For now, assuming the DTO allows it for validation purposes, even if service logic for this endpoint ignores it.
    it('should return 400 on validation error (e.g., invalid URL if avatarUrl were part of this DTO and validated)', async () => {
      const invalidProfileDto = {
        displayName: 'Valid Name',
        bio: 'Valid Bio',
        avatarUrl: 'not-a-valid-url',
      } as any;

      const response = await request(httpServer)
        .patch(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidProfileDto);

      expect(response.status).toBe(400);
      expect(response.body.message).toBeInstanceOf(Array);
      // Expect error due to non-whitelisted property 'avatarUrl'
      expect(response.body.message.some((msg: string) => msg.includes('property avatarUrl should not exist'))).toBeTruthy();
    });

    it('should ignore profileImagePublicId if sent in update (not leak to response)', async () => {
      const dtoWithImageId: UpdateUserDto = {
        displayName: 'DisplayName With ImageId Test',
      };
      const response = await request(httpServer)
        .patch(profileUrl)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...dtoWithImageId, profileImagePublicId: 'should_be_ignored' });

      // Expect 400 because profileImagePublicId is not a whitelisted property
      expect(response.status).toBe(400);
      expect(response.body.message).toBeInstanceOf(Array);
      expect(response.body.message.some((msg: string) => msg.includes('property profileImagePublicId should not exist'))).toBeTruthy();
    });
  });

  // --- Tests for GET /api/users/by-username/:username ---
  describe('GET /api/users/by-username/:username', () => {
    const baseUsernameUrl = '/api/users/by-username';

    it('should find a user by exact username (reflecting DB sanitization)', async () => {
      const rawUsername = 'findMeByUsername_INT';
      const user = await createUserViaApi({
        username: rawUsername,
        email: 'findmebyusername_int@example.com',
        password: 'PasswordFindMe1!',
      });
      const response = await request(httpServer).get(
        `${baseUsernameUrl}/${encodeURIComponent(user.username)}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.username).toEqual(user.username);
      expect(response.body._id).toEqual(user._id);
      expect(response.body.id).toEqual(user.id);
      expect(response.body.passwordHash).toBeUndefined();
      expect(response.body.email).toBeDefined();
      expect(response.body.role).toBeDefined();
    });

    it('should return 404 if user not found by username (case-sensitive check)', async () => {
      await createUserViaModel({
        username: 'AnotherUser_INT',
        email: 'anotheruser_int@example.com',
        password: 'PasswordAnother1!',
      });
      const lookupUsername = 'anotheruser_int_lower';
      const response = await request(httpServer).get(
        `${baseUsernameUrl}/${lookupUsername}`,
      );
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(
        `User with username ${lookupUsername} not found`,
      );
    });

    it('should return 404 if username does not exist in the database', async () => {
      const response = await request(httpServer).get(
        `${baseUsernameUrl}/nonExistentUser_INT`,
      );
      expect(response.status).toBe(404);
      expect(response.body.message).toEqual(
        'User with username nonExistentUser_INT not found',
      );
    });

    it('should find user with special characters in original username (after sanitization)', async () => {
      const complexRawUsername = 'user@name#special';
      const user = await createUserViaApi({
        username: complexRawUsername,
        email: 'complex_int@example.com',
        password: 'PasswordComplex1!',
      });
      const response = await request(httpServer).get(
        `${baseUsernameUrl}/${encodeURIComponent(user.username)}`,
      );
      expect(response.status).toBe(200);
      expect(response.body.username).toEqual(user.username);
    });
  });

  // --- Tests for GET /api/users/by-cheek-count ---
  describe('GET /api/users/by-cheek-count', () => {
    const cheekCountUrl = '/api/users/by-cheek-count';

    let userA: any;
    let userB: any;
    let userC: any;

    beforeEach(async () => {
      await userModel.deleteMany({});
      userA = await createUserViaModel({ username: 'CheekUserA_INT_CC', email: 'cheeka_int_cc@example.com', password: 'password' });
      userB = await createUserViaModel({ username: 'CheekUserB_INT_CC', email: 'cheekb_int_cc@example.com', password: 'password' });
      await createCheekViaModel({ owner: userB._id as Types.ObjectId, title: 'CheekB1', slug: 'cheekb1', categoryId: new Types.ObjectId(), isPublic: true });
      await createCheekViaModel({ owner: userB._id as Types.ObjectId, title: 'CheekB2', slug: 'cheekb2', categoryId: new Types.ObjectId(), isPublic: true });
      userC = await createUserViaModel({ username: 'CheekUserC', email: 'cheekc@example.com', password: 'password' });
      await createCheekViaModel({ owner: userC._id as Types.ObjectId, title: 'CheekC1', slug: 'cheekc1', categoryId: new Types.ObjectId(), isPublic: true });
    });

    it('should return 400 if the "min" query parameter is missing for by-cheek-count', async () => {
      const response = await request(httpServer).get(cheekCountUrl);
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Minimum cheek count must be a non-negative number.');
      expect(response.body.error).toEqual('Bad Request');
    });

    it('should return 400 if the "min" query parameter is invalid (negative)', async () => {
      const response = await request(httpServer).get(`${cheekCountUrl}?min=-1`);
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Minimum cheek count must be a non-negative number.');
      expect(response.body.error).toEqual('Bad Request');
    });

    it('should return 400 if the "min" query parameter is invalid (not a number)', async () => {
      const response = await request(httpServer).get(`${cheekCountUrl}?min=abc`);
      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Minimum cheek count must be a non-negative number.');
      expect(response.body.error).toEqual('Bad Request');
    });

    it('should filter users by minimum cheek count if min query param is valid', async () => {
      const response = await request(httpServer).get(`${cheekCountUrl}?min=1`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      response.body.forEach(user => {
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        expect(user).not.toHaveProperty('passwordHash');
      });
    });
  });

  // --- Tests for PATCH /api/users/admin/:userIdToUpdate/role (Admin Only) ---
  describe('PATCH /api/users/admin/:userIdToUpdate/role', () => {
    const baseAdminRoleUrl = '/api/users/admin'; // e.g., /api/users/admin/someUserId/role
    let adminUser: UserDocument;
    let regularUserToken: string;
    let targetUser: UserDocument;
    let adminToken: string;

    beforeEach(async () => {
      // Create an admin user
      adminUser = await createUserViaModel({
        username: 'admin_role_changer_int',
        email: 'admin_role_changer_int@example.com',
        password: 'PasswordAdminRole1!',
      }, 'admin');
      adminToken = jwtService.sign({ id: (adminUser._id as Types.ObjectId).toString(), username: adminUser.username, role: adminUser.role });

      // Create a regular user (for testing non-admin access attempt)
      const regularUser = await createUserViaModel({
        username: 'regular_role_user_int',
        email: 'regular_role_user_int@example.com',
        password: 'PasswordRegularRole1!',
      }, 'user');
      regularUserToken = jwtService.sign({ id: (regularUser._id as Types.ObjectId).toString(), username: regularUser.username, role: regularUser.role });

      // Create a target user whose role will be changed
      targetUser = await createUserViaModel({
        username: 'target_role_user_int',
        email: 'target_role_user_int@example.com',
        password: 'PasswordTargetRole1!',
      }, 'user'); // Starts as a regular user
    });

    it('should allow an admin to change a user role to "admin"', async () => {
      const response = await request(httpServer)
        .patch(`${baseAdminRoleUrl}/${(targetUser._id as Types.ObjectId).toString()}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.role).toEqual('admin');

      const updatedUser = await userModel.findById(targetUser._id);
      expect(updatedUser!.role).toEqual('admin');
    });

    it('should allow an admin to change a user role to "user"', async () => {
      // First, make the target user an admin
      targetUser.role = 'admin';
      await targetUser.save();

      const response = await request(httpServer)
        .patch(`${baseAdminRoleUrl}/${(targetUser._id as Types.ObjectId).toString()}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' });

      expect(response.status).toBe(200);
      expect(response.body.role).toEqual('user');

      const updatedUser = await userModel.findById(targetUser._id);
      expect(updatedUser!.role).toEqual('user');
    });

    it('should return 403 if a non-admin user tries to change a role', async () => {
      const response = await request(httpServer)
        .patch(`${baseAdminRoleUrl}/${(targetUser._id as Types.ObjectId).toString()}/role`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(403);
    });

    it('should return 401 if no authentication token is provided', async () => {
      const response = await request(httpServer)
        .patch(`${baseAdminRoleUrl}/${(targetUser._id as Types.ObjectId).toString()}/role`)
        .send({ role: 'admin' });

      expect(response.status).toBe(401);
    });

    it('should return 404 if the target user ID does not exist', async () => {
      const nonExistentUserId = new Types.ObjectId().toHexString();
      const response = await request(httpServer)
        .patch(`${baseAdminRoleUrl}/${nonExistentUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(404);
    });

    it('should return 400 if the provided role is invalid (e.g., "moderator")', async () => {
      const response = await request(httpServer)
        .patch(`${baseAdminRoleUrl}/${(targetUser._id as Types.ObjectId).toString()}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(['role must be one of the following values: user, admin']);
    });

    it('should return 400 if trying to change the role of a non-existent user ID format', async () => {
      const response = await request(httpServer)
        .patch(`${baseAdminRoleUrl}/invalidUserIdFormat/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual('Invalid target user ID format.');
    });

    it('should not allow an admin to change their own role via this endpoint', async () => {
      const response = await request(httpServer)
        .patch(`${baseAdminRoleUrl}/${(adminUser._id as Types.ObjectId).toString()}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' });

      expect(response.status).toBe(400); 
      expect(response.body.message).toEqual('Admins cannot change their own role using this endpoint.');
      const adminInDb = await userModel.findById(adminUser._id);
      expect(adminInDb!.role).toEqual('admin'); // Role should remain admin
    });
  });

  // --- Tests for DELETE /api/users/admin/:userIdToDelete (Admin Only) ---
  describe('DELETE /api/users/admin/:userIdToDelete', () => {
    const baseAdminDeleteUrl = '/api/users/admin'; // e.g., /api/users/admin/someUserId
    let adminUser: UserDocument;
    let regularUser: UserDocument;
    let userToDelete: UserDocument;
    let adminToken: string;
    let regularUserToken: string;

    beforeEach(async () => {
      // Create an admin user
      adminUser = await createUserViaModel({
        username: 'admin_deleter_int',
        email: 'admin_deleter_int@example.com',
        password: 'PasswordAdminDelete1!',
      }, 'admin');
      adminToken = jwtService.sign({ id: (adminUser._id as Types.ObjectId).toString(), username: adminUser.username, role: adminUser.role });

      // Create a regular user (for testing non-admin access)
      regularUser = await createUserViaModel({
        username: 'regular_deleter_int',
        email: 'regular_deleter_int@example.com',
        password: 'PasswordRegularDelete1!',
      }, 'user');
      regularUserToken = jwtService.sign({ id: (regularUser._id as Types.ObjectId).toString(), username: regularUser.username, role: regularUser.role });

      // Create a user to be deleted in tests
      userToDelete = await createUserViaModel({
        username: 'user_to_delete_int',
        email: 'user_to_delete_int@example.com',
        password: 'PasswordToDelete1!',
      }, 'user');
    });

    it('should allow an admin to delete another user', async () => {
      const response = await request(httpServer)
        .delete(`${baseAdminDeleteUrl}/${(userToDelete._id as Types.ObjectId).toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // Optionally, check response body if the endpoint returns one (e.g., { message: 'User deleted' })
      // For example: expect(response.body.message).toEqual('User deleted successfully');

      // Verify the user is actually deleted from the database
      const deletedUserInDb = await userModel.findById(userToDelete._id);
      expect(deletedUserInDb).toBeNull();
    });

    it('should return 403 if a non-admin user tries to delete a user', async () => {
      const response = await request(httpServer)
        .delete(`${baseAdminDeleteUrl}/${(userToDelete._id as Types.ObjectId).toString()}`)
        .set('Authorization', `Bearer ${regularUserToken}`); // Use regular user token

      expect(response.status).toBe(403);

      // Verify the user is NOT deleted from the database
      const userStillInDb = await userModel.findById(userToDelete._id);
      expect(userStillInDb).not.toBeNull();
    });

    it('should return 401 if no authentication token is provided', async () => {
      const response = await request(httpServer)
        .delete(`${baseAdminDeleteUrl}/${(userToDelete._id as Types.ObjectId).toString()}`);

      expect(response.status).toBe(401);
      // Verify the user is NOT deleted
      const userStillInDb = await userModel.findById(userToDelete._id);
      expect(userStillInDb).not.toBeNull();
    });

    it('should return 404 if the target user ID to delete does not exist', async () => {
      const nonExistentUserId = new Types.ObjectId().toHexString();
      const response = await request(httpServer)
        .delete(`${baseAdminDeleteUrl}/${nonExistentUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 400 for an invalid user ID format for deletion', async () => {
      const invalidUserId = 'invalid-id-format';
      const response = await request(httpServer)
        .delete(`${baseAdminDeleteUrl}/${invalidUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      // Optionally check for a specific error message if your API provides one
      // expect(response.body.message).toContain('Invalid user ID format');
    });

    it('should (optionally) prevent an admin from deleting themselves via this route, or handle it gracefully', async () => {
      // This test depends on the desired application logic.
      // Scenario 1: Admin cannot delete themselves.
      const response = await request(httpServer)
        .delete(`${baseAdminDeleteUrl}/${(adminUser._id as Types.ObjectId).toString()}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Expect a 403 Forbidden or 400 Bad Request, or a specific error message
      expect(response.status).toBe(400); // Or 403, depending on implementation
      // expect(response.body.message).toEqual('Admins cannot delete themselves.');

      // Verify the admin user is NOT deleted from the database
      const adminStillInDb = await userModel.findById(adminUser._id);
      expect(adminStillInDb).not.toBeNull();

      // Scenario 2: Admin can delete themselves (less common for this type of admin endpoint)
      // If so, the status code would be 200, and you'd verify they are deleted.
    });
  });
});
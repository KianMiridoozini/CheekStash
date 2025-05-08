// test/integration/auth.integration-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module'; // Import root module
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import * as bcrypt from 'bcrypt'; // Need bcrypt for setup
import { MongooseCastErrorFilter } from '../../src/common/filters/mongoose-cast-error/mongoose-cast-error.filter'; // Adjust path if needed
import { JwtService } from '@nestjs/jwt';
// Import DTOs used by AuthController
import { LoginUserDto } from '../../src/users/dto/login-user.dto';
import { ChangePasswordDto } from '../../src/users/dto/change-password.dto'; // Assuming it's in users/dto
import { ConfirmPasswordDto } from '../../src/auth/dto/confirm-password.dto'; // Assuming this DTO exists

let app: INestApplication;
let httpServer: any;
let userModel: Model<UserDocument>;
let jwtService: JwtService;

// --- Test User Data ---
const testPassword = 'Password123!';
const testUserData = {
  username: 'auth_test_user',
  email: 'auth_test@example.com',
  password: testPassword, // Store plain password for login tests
};
let createdUser: UserDocument | null = null;
let authToken: string | null = null;

// --- Helper to create user directly for setup ---
const createUserDirectly = async (
  userData: Partial<User>,
): Promise<UserDocument> => {
  const user = new userModel(userData);
  return user.save();
};

// --- Setup ---
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
      // transform: true, // Keep transform: true
      // transformOptions: {
      //   enableImplicitConversion: true,
      // },
    }),
  );

  app.useGlobalFilters(new MongooseCastErrorFilter());
  await app.init();
  httpServer = app.getHttpServer();
  userModel = moduleFixture.get<Model<UserDocument>>(getModelToken(User.name));
  jwtService = moduleFixture.get<JwtService>(JwtService);
});

// --- Cleanup ---
beforeEach(async () => {
  await userModel.deleteMany({});
  // Reset state variables
  createdUser = null;
  authToken = null;

  // Create the primary test user for most auth tests
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  createdUser = await createUserDirectly({
    username: testUserData.username,
    email: testUserData.email,
    passwordHash: hashedPassword,
    role: 'user',
  });
  expect(createdUser).not.toBeNull(); // Ensure user creation worked

  // Generate token for the created user
  if (createdUser) {
    const payload = {
      id: createdUser.id,
      username: createdUser.username,
      role: createdUser.role,
    };
    authToken = jwtService.sign(payload);
  }
  expect(authToken).not.toBeNull();
});

afterAll(async () => {
  await userModel.deleteMany({}); // Final cleanup
  await app.close();
});

// --- Test Suites ---

describe('POST /api/auth/login', () => {
  const loginUrl = '/api/auth/login';
  const validLoginDto: LoginUserDto = {
    email: testUserData.email,
    password: testUserData.password,
  };

  it('should login successfully with correct credentials and return token/username', async () => {
    const response = await request(httpServer)
      .post(loginUrl)
      .send(validLoginDto);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body).toHaveProperty('username', testUserData.username);

    const decoded = jwtService.verify(response.body.token);
    expect(decoded.id).toEqual(createdUser!.id); 
    expect(decoded.username).toEqual(testUserData.username);
  });

  it('should return 401 for incorrect password', async () => {
    const invalidLoginDto: LoginUserDto = {
      email: testUserData.email,
      password: 'WrongPassword!',
    };
    const response = await request(httpServer)
      .post(loginUrl)
      .send(invalidLoginDto);

    expect(response.status).toBe(401);
    expect(response.body.message).toEqual('Invalid credentials');
  });

  it('should return 404 for non-existent email', async () => {
    const nonExistentLoginDto: LoginUserDto = {
      email: 'nosuchuser@example.com',
      password: testUserData.password,
    };
    const response = await request(httpServer)
      .post(loginUrl)
      .send(nonExistentLoginDto);

    expect(response.status).toBe(404);
    // Check the specific message from AuthService.validateUser
    expect(response.body.message).toEqual('User not found');
  });

  it('should return 400 on validation error (e.g., invalid email)', async () => {
    const invalidDto = {
      email: 'not-an-email', // Invalid email format
      password: testUserData.password,
    };
    const response = await request(httpServer).post(loginUrl).send(invalidDto);

    expect(response.status).toBe(400);
    expect(response.body.message).toBeInstanceOf(Array);
    expect(response.body.error).toEqual('Bad Request');
  });
});

describe('PUT /api/auth/password', () => {
  const changePasswordUrl = '/api/auth/password';
  const validChangeDto: ChangePasswordDto = {
    oldPassword: testUserData.password, // Use the original plain text password
    newPassword: 'NewPassword456!',
  };

  it('should change password successfully with correct old password and token', async () => {
    const response = await request(httpServer)
      .put(changePasswordUrl)
      .set('Authorization', `Bearer ${authToken}`)
      .send(validChangeDto);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Password updated successfully',
    });

    const loginDto: LoginUserDto = {
      email: testUserData.email,
      password: validChangeDto.newPassword, // Use the NEW password
    };
    const loginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send(loginDto);

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('token');

    // --- Optional: Verification by fetching user and comparing hash (more complex) ---
    // const userWithHash = await userModel.findById(createdUser!.id).select('+passwordHash');
    // expect(userWithHash).not.toBeNull();
    // const isNewPasswordCorrect = await bcrypt.compare(validChangeDto.newPassword, userWithHash!.passwordHash);
    // expect(isNewPasswordCorrect).toBe(true);
    // const isOldPasswordIncorrect = await bcrypt.compare(validChangeDto.oldPassword, userWithHash!.passwordHash);
    // expect(isOldPasswordIncorrect).toBe(false);
  });

  it('should return 401 if old password is incorrect', async () => {
    const invalidChangeDto: ChangePasswordDto = {
      oldPassword: 'WrongOldPassword!',
      newPassword: 'NewPassword456!',
    };

    const response = await request(httpServer)
      .put(changePasswordUrl)
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidChangeDto);

    expect(response.status).toBe(401);
    expect(response.body.message).toEqual('Incorrect old password');
  });

  it('should return 401 if no token is provided', async () => {
    const response = await request(httpServer)
      .put(changePasswordUrl)
      .send(validChangeDto); // Send without Auth header

    expect(response.status).toBe(401);
    expect(response.body.message).toEqual('Unauthorized access');
  });

  it('should return 401 if token is invalid/expired', async () => {
    const invalidToken = 'this.is.not.a.valid.token';
    const response = await request(httpServer)
      .put(changePasswordUrl)
      .set('Authorization', `Bearer ${invalidToken}`)
      .send(validChangeDto);

    expect(response.status).toBe(401);
    expect(response.body.message).toEqual('Unauthorized access');
  });

  it('should return 400 on validation error (e.g., short new password)', async () => {
    const invalidDto: ChangePasswordDto = {
      oldPassword: testUserData.password,
      newPassword: 'short', // Too short
    };

    const response = await request(httpServer)
      .put(changePasswordUrl)
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidDto);

    expect(response.status).toBe(400); // Validation pipe should catch this
    expect(response.body.message).toBeInstanceOf(Array);
    // Add specific check for newPassword validation message if needed from ChangePasswordDto
    expect(
      response.body.message.some((msg: string) =>
        msg.includes('newPassword must be longer than or equal to'),
      ),
    ).toBeTruthy();
  });
});

// --- TODO: Add describe block for DELETE /api/auth/account ---
describe('DELETE /api/auth/account', () => {
  const deleteAccountUrl = '/api/auth/account';
  const validConfirmDto: ConfirmPasswordDto = {
    password: testPassword, // Use the correct original plain text password
  };

  it('should delete account successfully with correct password and token', async () => {
    // Ensure user exists before delete
    const userBeforeDelete = await userModel.findById(createdUser!.id);
    expect(userBeforeDelete).not.toBeNull();

    const response = await request(httpServer)
      .delete(deleteAccountUrl)
      .set('Authorization', `Bearer ${authToken}`)
      .send(validConfirmDto);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'User and all associated cheeks and reviews have been deleted', // Match exact message from service
    });

    // --- Verification ---
    // 1. Check user is deleted from DB
    const userAfterDelete = await userModel.findById(createdUser!.id);
    expect(userAfterDelete).toBeNull();

    // 2. Attempt to login with old credentials (should fail)
    const loginDto: LoginUserDto = {
      email: testUserData.email,
      password: testPassword,
    };
    const loginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send(loginDto);

    expect(loginResponse.status).toBe(404); // Expect Not Found as user doesn't exist
    expect(loginResponse.body.message).toEqual('User not found');
  });

  it('should return 401 if password confirmation is incorrect', async () => {
    const invalidConfirmDto: ConfirmPasswordDto = {
      password: 'WrongPassword!',
    };

    const response = await request(httpServer)
      .delete(deleteAccountUrl)
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidConfirmDto);

    expect(response.status).toBe(401);
    // Check message from AuthService.deleteUser -> UsersService -> bcrypt compare fail
    expect(response.body.message).toEqual('Password confirmation failed');

    // Verify user still exists
    const userNotDeleted = await userModel.findById(createdUser!.id);
    expect(userNotDeleted).not.toBeNull();
  });

  it('should return 401 if no token is provided', async () => {
    const response = await request(httpServer)
      .delete(deleteAccountUrl)
      .send(validConfirmDto); // Send without Auth header

    expect(response.status).toBe(401);
    expect(response.body.message).toEqual('Unauthorized access'); // Or "Unauthorized" depending on guard
  });

  it('should return 401 if token is invalid/expired', async () => {
    const invalidToken = 'this.is.not.a.valid.token';
    const response = await request(httpServer)
      .delete(deleteAccountUrl)
      .set('Authorization', `Bearer ${invalidToken}`)
      .send(validConfirmDto);

    expect(response.status).toBe(401);
    expect(response.body.message).toEqual('Unauthorized access');
  });

  it('should return 400 on validation error (e.g., missing password)', async () => {
    const invalidDto = {};

    const response = await request(httpServer)
      .delete(deleteAccountUrl)
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidDto);

    expect(response.status).toBe(400);
    expect(response.body.message).toBeInstanceOf(Array);
    expect(response.body.error).toEqual('Bad Request');
    expect(
      response.body.message.some((msg: string) =>
        msg.includes('Password should not be empty'),
      ),
    ).toBeTruthy();
  });
  it('should return 400 on validation error (e.g., password not a string)', async () => {
    const invalidDto = { password: 123456 };

    const response = await request(httpServer)
      .delete(deleteAccountUrl)
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidDto);

    expect(response.status).toBe(400);
    expect(response.body.message).toBeInstanceOf(Array);
    expect(response.body.error).toEqual('Bad Request');
    expect(
      response.body.message.some((msg: string) =>
        msg.includes('Password must be a string'),
      ),
    ).toBeTruthy();
  });
});

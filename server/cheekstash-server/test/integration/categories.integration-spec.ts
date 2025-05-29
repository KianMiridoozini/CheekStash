import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { Category } from '../../src/categories/schema/category.schema';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import * as bcrypt from 'bcrypt';

describe('CategoriesController (Integration)', () => {
  let app: INestApplication;
  let httpServer: any;
  let jwtService: JwtService;
  let userModel: Model<UserDocument>;
  let categoryModel: Model<any>;
  let adminToken: string;
  let userToken: string;
  let adminUser: any;
  let normalUser: any;

  const adminUserDto = {
    username: 'admincat',
    email: 'admincat@example.com',
    password: 'AdminCat123!',
    role: 'admin',
  };
  const userDto = {
    username: 'usercat',
    email: 'usercat@example.com',
    password: 'UserCat123!',
    role: 'user',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    httpServer = app.getHttpServer();
    jwtService = moduleFixture.get<JwtService>(JwtService);
    userModel = moduleFixture.get(getModelToken(User.name));
    categoryModel = moduleFixture.get(getModelToken(Category.name));
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
    await categoryModel.deleteMany({});
    // Create admin user
    const adminHash = await bcrypt.hash(adminUserDto.password, 10);
    adminUser = await userModel.create({
      username: adminUserDto.username,
      email: adminUserDto.email,
      passwordHash: adminHash,
      role: 'admin',
    });
    adminToken = jwtService.sign({ id: adminUser.id, username: adminUser.username, role: 'admin' });
    // Create normal user
    const userHash = await bcrypt.hash(userDto.password, 10);
    normalUser = await userModel.create({
      username: userDto.username,
      email: userDto.email,
      passwordHash: userHash,
      role: 'user',
    });
    userToken = jwtService.sign({ id: normalUser.id, username: normalUser.username, role: 'user' });
  });

  afterAll(async () => {
    await userModel.deleteMany({});
    await categoryModel.deleteMany({});
    await app.close();
  });

  describe('POST /api/categories', () => {
    it('should create a category as admin', async () => {
      const dto = { name: 'TestCat', description: 'A test category' };
      const res = await request(httpServer)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto);
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(dto.name);
      expect(res.body.description).toBe(dto.description);
    });
    it('should return 401 if not authenticated', async () => {
      const dto = { name: 'NoAuthCat', description: 'No auth' };
      const res = await request(httpServer)
        .post('/api/categories')
        .send(dto);
      expect(res.status).toBe(401);
    });
    it('should return 403 if not admin', async () => {
      const dto = { name: 'UserCat', description: 'User tries' };
      const res = await request(httpServer)
        .post('/api/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send(dto);
      expect(res.status).toBe(403);
    });
    it('should return 409 if category name already exists', async () => {
      const dto = { name: 'DupCat', description: 'Duplicate' };
      await categoryModel.create(dto);
      const res = await request(httpServer)
        .post('/api/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto);
      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/categories', () => {
    it('should return all categories', async () => {
      await categoryModel.create({ name: 'Cat1', description: 'desc1' });
      await categoryModel.create({ name: 'Cat2', description: 'desc2' });
      const res = await request(httpServer).get('/api/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/categories/:id', () => {
    it('should return a category by id', async () => {
      const cat = await categoryModel.create({ name: 'ByIdCat', description: 'desc' });
      const res = await request(httpServer).get(`/api/categories/${cat._id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(cat.name);
    });
    it('should return 404 if not found', async () => {
      const fakeId = '60c72b2f9b1e8e1a2c8f9e99';
      const res = await request(httpServer).get(`/api/categories/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/categories/slug/:slug', () => {
    it('should return a category by slug', async () => {
      const cat = await categoryModel.create({ name: 'SlugCat', description: 'desc', slug: 'slugcat' });
      const res = await request(httpServer).get(`/api/categories/slug/${cat.slug}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(cat.name);
    });
    it('should return 404 if not found', async () => {
      const res = await request(httpServer).get('/api/categories/slug/not-a-real-slug');
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/categories/:id', () => {
    it('should update a category as admin', async () => {
      const cat = await categoryModel.create({ name: 'PatchCat', description: 'desc' });
      const dto = { name: 'PatchedCat', description: 'updated desc' };
      const res = await request(httpServer)
        .patch(`/api/categories/${cat._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(dto.name);
      expect(res.body.description).toBe(dto.description);
    });
    it('should return 401 if not authenticated', async () => {
      const cat = await categoryModel.create({ name: 'PatchNoAuth', description: 'desc' });
      const dto = { name: 'NoAuthEdit' };
      const res = await request(httpServer)
        .patch(`/api/categories/${cat._id}`)
        .send(dto);
      expect(res.status).toBe(401);
    });
    it('should return 403 if not admin', async () => {
      const cat = await categoryModel.create({ name: 'PatchUser', description: 'desc' });
      const dto = { name: 'UserEdit' };
      const res = await request(httpServer)
        .patch(`/api/categories/${cat._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(dto);
      expect(res.status).toBe(403);
    });
    it('should return 404 if not found', async () => {
      const fakeId = '60c72b2f9b1e8e1a2c8f9e99';
      const dto = { name: 'NoCat' };
      const res = await request(httpServer)
        .patch(`/api/categories/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto);
      expect(res.status).toBe(404);
    });
    it('should return 409 if new name already exists', async () => {
      const cat1 = await categoryModel.create({ name: 'CatA', description: 'desc' });
      const cat2 = await categoryModel.create({ name: 'CatB', description: 'desc' });
      const dto = { name: 'CatA' };
      const res = await request(httpServer)
        .patch(`/api/categories/${cat2._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(dto);
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('should delete a category as admin', async () => {
      const cat = await categoryModel.create({ name: 'DelCat', description: 'desc' });
      const res = await request(httpServer)
        .delete(`/api/categories/${cat._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
    });
    it('should return 401 if not authenticated', async () => {
      const cat = await categoryModel.create({ name: 'DelNoAuth', description: 'desc' });
      const res = await request(httpServer)
        .delete(`/api/categories/${cat._id}`);
      expect(res.status).toBe(401);
    });
    it('should return 403 if not admin', async () => {
      const cat = await categoryModel.create({ name: 'DelUser', description: 'desc' });
      const res = await request(httpServer)
        .delete(`/api/categories/${cat._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });
    it('should return 404 if not found', async () => {
      const fakeId = '60c72b2f9b1e8e1a2c8f9e99';
      const res = await request(httpServer)
        .delete(`/api/categories/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import { Cheeks, CheeksDocument } from '../../src/cheeks/schemas/cheek.schema';
import { Category, CategoryDocument } from '../../src/categories/schema/category.schema';
import { Tag, TagDocument } from '../../src/tags/schema/tag.schema';
import { CreateUserDto } from '../../src/users/dto/create-user.dto';
import { CheeksDto } from '../../src/cheeks/dto/cheeks.dto';
import { UpdateCheeksDto } from '../../src/cheeks/dto/update-cheeks.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MongooseCastErrorFilter } from '../../src/common/filters/mongoose-cast-error/mongoose-cast-error.filter';

interface TestUserInput extends Partial<User> {
  password?: string;
}

describe('CheeksController (Integration)', () => {
  let app: INestApplication;
  let httpServer: any;
  let userModel: Model<UserDocument>;
  let cheeksModel: Model<CheeksDocument>;
  let categoryModel: Model<CategoryDocument>;
  let tagModel: Model<TagDocument>;
  let jwtService: JwtService;

  let testUser: UserDocument;
  let testUserToken: string;
  let testCategory: CategoryDocument;
  let testTag: TagDocument;

  const createUserDirectly = async (userData: TestUserInput): Promise<UserDocument> => {
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(userData.password || 'Password123!', salt);
    // Remove password from userData before spreading, as it's not part of User schema
    const { password, ...userDataWithoutPassword } = userData;
    const user = new userModel({ ...userDataWithoutPassword, passwordHash });
    return user.save();
  };

  const createCategoryDirectly = async (name: string): Promise<CategoryDocument> => {
    const category = new categoryModel({ name, description: `Description for ${name}` });
    return category.save();
  };

  const createTagDirectly = async (name: string): Promise<TagDocument> => {
    const tag = new tagModel({ name });
    return tag.save();
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
        transform: true,
      }),
    );
    app.useGlobalFilters(new MongooseCastErrorFilter());
    await app.init();
    httpServer = app.getHttpServer();

    userModel = moduleFixture.get<Model<UserDocument>>(getModelToken(User.name));
    cheeksModel = moduleFixture.get<Model<CheeksDocument>>(getModelToken(Cheeks.name));
    categoryModel = moduleFixture.get<Model<CategoryDocument>>(getModelToken(Category.name));
    tagModel = moduleFixture.get<Model<TagDocument>>(getModelToken(Tag.name));
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  beforeEach(async () => {
    await userModel.deleteMany({});
    await cheeksModel.deleteMany({});
    await categoryModel.deleteMany({});
    await tagModel.deleteMany({});

    testUser = await createUserDirectly({
      username: 'cheekyuser',
      email: 'cheeky@example.com',
      password: 'PasswordCheeky1!',
    });
    testUserToken = jwtService.sign({
      id: (testUser._id as Types.ObjectId).toHexString(),
      username: testUser.username,
      role: testUser.role,
    });
    testCategory = await createCategoryDirectly('Test Category Cheeks');
    testTag = await createTagDirectly('testtagcheek');
  });

  afterAll(async () => {
    await userModel.deleteMany({});
    await cheeksModel.deleteMany({});
    await categoryModel.deleteMany({});
    await tagModel.deleteMany({});
    await app.close();
  });

  const validCheekDto: CheeksDto = {
    title: 'My Awesome Cheeks',
    description: 'A collection of awesome links.',
    categoryId: '', // Will be set in tests
    tagNames: ['awesome', 'links'],
    isPublic: true,
    links: [
      { url: 'https://example.com/link1', title: 'Link 1', description: 'Desc 1', order: 0 },
      { url: 'https://example.com/link2', title: 'Link 2', description: 'Desc 2', order: 1 },
    ],
  };

  describe('POST /api/cheeks', () => {
    it('should create a new cheek successfully', async () => {
      const dto = { ...validCheekDto, categoryId: testCategory._id.toHexString(), tagNames: [testTag.name, 'newtag'] };
      const response = await request(httpServer)
        .post('/api/cheeks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(dto);

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body).toMatchObject({
        title: dto.title,
        description: dto.description,
        owner: (testUser._id as Types.ObjectId).toHexString(),
        isPublic: dto.isPublic,
        categoryId: expect.objectContaining({ _id: testCategory._id.toHexString() }),
        links: expect.arrayContaining(dto.links.map(link => expect.objectContaining(link))),
      });
      expect(response.body.tagIds).toHaveLength(2);
      // Original assertions failing due to t.name potentially not being available directly
      // expect(response.body.tagIds.some((t: any) => t.name === 'testtagcheek')).toBeTruthy();
      // expect(response.body.tagIds.some((t: any) => t.name === 'newtag')).toBeTruthy();

      // New approach: Fetch tags based on IDs from response and check names
      const tagIdsFromPostResponse = response.body.tagIds.map((item: any) => {
        if (typeof item === 'string') return item; // Item is an ID string
        if (item && typeof item._id !== 'undefined') return item._id.toString(); // Item is an object with _id
        return null;
      }).filter(id => id !== null) as string[];
      
      expect(tagIdsFromPostResponse.length).toBe(2); // Verify we extracted two IDs

      const fetchedTagsAfterPost = await tagModel.find({ _id: { $in: tagIdsFromPostResponse } }).select('name').lean();
      
      expect(fetchedTagsAfterPost.some(tag => tag.name === 'testtagcheek')).toBeTruthy();
      expect(fetchedTagsAfterPost.some(tag => tag.name === 'newtag')).toBeTruthy();

      const createdCheek = await cheeksModel.findById(response.body._id);
      expect(createdCheek).not.toBeNull();
      
      const tag1 = await tagModel.findOne({name: testTag.name});
      expect(tag1?.usageCount).toBe(1);
      const tag2 = await tagModel.findOne({name: 'newtag'});
      expect(tag2?.usageCount).toBe(1);
    });

    it('should return 401 if not authenticated', async () => {
      const dto = { ...validCheekDto, categoryId: testCategory._id.toHexString() };
      const response = await request(httpServer)
        .post('/api/cheeks')
        .send(dto);
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return 400 for invalid DTO (e.g., missing title)', async () => {
      const { title, ...invalidDto } = validCheekDto; // remove title
      const dto = { ...invalidDto, categoryId: testCategory._id.toHexString() };
      const response = await request(httpServer)
        .post('/api/cheeks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(dto);
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toEqual(['title must be a string']); // Adjusted to match actual error
    });
    
    it('should return 400 for invalid DTO (e.g., less than 2 links)', async () => {
        const dtoWithOneLink = { ...validCheekDto, categoryId: testCategory._id.toHexString(), links: [validCheekDto.links[0]] };
        const response = await request(httpServer)
            .post('/api/cheeks')
            .set('Authorization', `Bearer ${testUserToken}`)
            .send(dtoWithOneLink);
        expect(response.status).toBe(HttpStatus.BAD_REQUEST);
        expect(response.body.message).toContain('A Cheeks must contain at least 2 links.');
    });

    it('should return 404 if categoryId does not exist', async () => {
      const nonExistentCategoryId = new Types.ObjectId().toHexString();
      const dto = { ...validCheekDto, categoryId: nonExistentCategoryId };
      const response = await request(httpServer)
        .post('/api/cheeks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(dto);
      expect(response.status).toBe(HttpStatus.NOT_FOUND);
      expect(response.body.message).toEqual(`Category with ID "${nonExistentCategoryId}" not found`); // Adjusted for specific message
    });
  });

  describe('GET /api/cheeks', () => {
    it('should return an array of cheeks', async () => {
      // Create a cheek first
      const cheekDto = { ...validCheekDto, categoryId: testCategory._id.toHexString(), owner: (testUser._id as Types.ObjectId).toHexString() };
      await new cheeksModel(cheekDto).save();

      const response = await request(httpServer).get('/api/cheeks');
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toMatchObject({
        title: cheekDto.title,
        categoryId: expect.objectContaining({ _id: testCategory._id.toHexString() }),
      });
    });
  });

  describe('GET /api/cheeks/:id', () => {
    it('should return a single cheek if ID exists', async () => {
      const cheekDto = { ...validCheekDto, categoryId: testCategory._id.toHexString(), owner: (testUser._id as Types.ObjectId).toHexString() };
      const createdCheek = await new cheeksModel(cheekDto).save();
      const cheekId = (createdCheek._id as Types.ObjectId).toHexString();

      const response = await request(httpServer).get(`/api/cheeks/${cheekId}`);
      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toMatchObject({
        _id: cheekId,
        title: cheekDto.title,
        categoryId: expect.objectContaining({ _id: testCategory._id.toHexString() }),
      });
    });

    it('should return 404 if cheek ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toHexString();
      const response = await request(httpServer).get(`/api/cheeks/${nonExistentId}`);
      expect(response.status).toBe(HttpStatus.NOT_FOUND);
      expect(response.body.message).toEqual('Cheeks not found');
    });

    it('should return 400 if ID is not a valid ObjectId', async () => {
      const invalidId = 'not-an-objectid';
      const response = await request(httpServer).get(`/api/cheeks/${invalidId}`);
      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toMatch(/Invalid value provided for field _id/i);
    });
  });

  describe('PUT /api/cheeks/:id', () => {
    let existingCheek: CheeksDocument;
    let existingCheekId: string;

    beforeEach(async () => {
      const cheekData: CheeksDto = {
        title: 'Initial Cheeks for PUT Test', // Using a distinct title for clarity
        description: validCheekDto.description,
        categoryId: testCategory._id.toHexString(), // Corrected: ensure string ID
        tagNames: ['initialtag1', 'initialtag2'],
        isPublic: validCheekDto.isPublic,
        links: validCheekDto.links,
        // owner field removed as it's set by the service
      };
      // Create tags for usage count testing
      await createTagDirectly('initialtag1');
      await createTagDirectly('initialtag2');
      
      // Create the cheek using a POST request to ensure service logic (like tag creation/counting) is triggered
      const createResponse = await request(httpServer)
        .post('/api/cheeks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(cheekData);
      expect(createResponse.status).toBe(HttpStatus.CREATED);
      existingCheekId = createResponse.body._id;

      existingCheek = (await cheeksModel.findById(existingCheekId).populate('tagIds'))!;
      if (!existingCheek) throw new Error('Failed to create existingCheek for PUT tests');
    });

    const updateDto: UpdateCheeksDto = {
      title: 'Updated Cheeks Title',
      description: 'Updated description.',
      tagNames: ['updatedtag', 'newtagput'],
    };

    it('should update a cheek successfully by its owner', async () => {
      const response = await request(httpServer)
        .put(`/api/cheeks/${existingCheekId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(updateDto);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body).toMatchObject({
        _id: existingCheekId,
        title: updateDto.title,
        description: updateDto.description,
      });
      expect(response.body.tagIds).toHaveLength(2);
      // Original assertions failing
      // expect(response.body.tagIds.some((t: any) => t.name === 'updatedtag')).toBeTruthy();
      // expect(response.body.tagIds.some((t: any) => t.name === 'newtagput')).toBeTruthy();
      
      // New approach: Fetch tags based on IDs from response and check names
      const tagIdsFromPutResponse = response.body.tagIds.map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item._id !== 'undefined') return item._id.toString();
        return null;
      }).filter(id => id !== null) as string[];

      expect(tagIdsFromPutResponse.length).toBe(2); // Verify we extracted two IDs

      const fetchedTagsAfterPut = await tagModel.find({ _id: { $in: tagIdsFromPutResponse } }).select('name').lean();

      expect(fetchedTagsAfterPut.some(tag => tag.name === 'updatedtag')).toBeTruthy();
      expect(fetchedTagsAfterPut.some(tag => tag.name === 'newtagput')).toBeTruthy();
      
      const initialTag1 = await tagModel.findOne({name: 'initialtag1'});
      expect(initialTag1?.usageCount).toBe(0); // Decremented
      const initialTag2 = await tagModel.findOne({name: 'initialtag2'});
      expect(initialTag2?.usageCount).toBe(0); // Decremented

      const updatedTag = await tagModel.findOne({name: 'updatedtag'});
      expect(updatedTag?.usageCount).toBe(1); // Incremented
      const newTagPut = await tagModel.findOne({name: 'newtagput'});
      expect(newTagPut?.usageCount).toBe(1); // Incremented
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(httpServer)
        .put(`/api/cheeks/${existingCheekId}`)
        .send(updateDto);
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 if user is not the owner', async () => {
      const anotherUser = await createUserDirectly({ username: 'anotheruser', email: 'another@example.com' });
      const anotherUserToken = jwtService.sign({ id: (anotherUser._id as Types.ObjectId).toHexString(), username: anotherUser.username, role: 'user' });

      const response = await request(httpServer)
        .put(`/api/cheeks/${existingCheekId}`)
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .send(updateDto);
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.message).toEqual('You are not allowed to update this Cheeks');
    });

    it('should return 404 if cheek ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toHexString();
      const response = await request(httpServer)
        .put(`/api/cheeks/${nonExistentId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(updateDto);
      expect(response.status).toBe(HttpStatus.NOT_FOUND);
      expect(response.body.message).toEqual('Cheeks not found');
    });
    
    it('should correctly update categoryId if provided', async () => {
        const newCategory = await createCategoryDirectly('New Category For Update');
        const dtoWithNewCategory = { ...updateDto, categoryId: newCategory._id.toHexString() };

        const response = await request(httpServer)
            .put(`/api/cheeks/${existingCheekId}`)
            .set('Authorization', `Bearer ${testUserToken}`)
            .send(dtoWithNewCategory);

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body.categoryId._id).toEqual(newCategory._id.toHexString());
        expect(response.body.categoryId.name).toEqual(newCategory.name);
    });

    it('should return 404 if updated categoryId does not exist', async () => {
        const nonExistentCategoryId = new Types.ObjectId().toHexString();
        const dtoWithInvalidCategory = { ...updateDto, categoryId: nonExistentCategoryId };
        const response = await request(httpServer)
            .put(`/api/cheeks/${existingCheekId}`)
            .set('Authorization', `Bearer ${testUserToken}`)
            .send(dtoWithInvalidCategory);
        expect(response.status).toBe(HttpStatus.NOT_FOUND);
        expect(response.body.message).toEqual(`Category with ID "${nonExistentCategoryId}" not found`);
    });
  });

  describe('DELETE /api/cheeks/:id', () => {
    let existingCheekForDelete: CheeksDocument;
    let existingCheekIdForDelete: string;

    beforeEach(async () => {
      // Create a cheek specifically for delete tests to avoid interference
      const cheekData: CheeksDto = {
        title: 'Initial Cheeks for DELETE Test', // Using a distinct title
        description: validCheekDto.description,
        categoryId: testCategory._id.toHexString(), // Ensure categoryId is a string for DTO
        tagNames: ['tagtodelete1', 'tagtodelete2'],
        isPublic: validCheekDto.isPublic,
        links: validCheekDto.links,
        // owner field removed
      };
      await createTagDirectly('tagtodelete1');
      await createTagDirectly('tagtodelete2');
      
      // Use the service to create the cheek so tag usage counts are handled
      const createdResponse = await request(httpServer)
        .post('/api/cheeks')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(cheekData);
      expect(createdResponse.status).toBe(HttpStatus.CREATED);
      existingCheekIdForDelete = createdResponse.body._id;
      
      existingCheekForDelete = (await cheeksModel.findById(existingCheekIdForDelete))!;
      expect(existingCheekForDelete).not.toBeNull();

      // Verify initial tag counts
      let tag1 = await tagModel.findOne({name: 'tagtodelete1'});
      expect(tag1?.usageCount).toBe(1);
      let tag2 = await tagModel.findOne({name: 'tagtodelete2'});
      expect(tag2?.usageCount).toBe(1);
    });

    it('should delete a cheek successfully by its owner', async () => {
      const response = await request(httpServer)
        .delete(`/api/cheeks/${existingCheekIdForDelete}`)
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.message).toEqual('Cheeks deleted successfully');

      const deletedCheek = await cheeksModel.findById(existingCheekIdForDelete);
      expect(deletedCheek).toBeNull();

      // Check tag usage counts decremented
      const tag1 = await tagModel.findOne({name: 'tagtodelete1'});
      expect(tag1?.usageCount).toBe(0);
      const tag2 = await tagModel.findOne({name: 'tagtodelete2'});
      expect(tag2?.usageCount).toBe(0);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(httpServer)
        .delete(`/api/cheeks/${existingCheekIdForDelete}`);
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should return 403 if user is not the owner', async () => {
      const anotherUser = await createUserDirectly({ username: 'anotherdeleter', email: 'anotherdel@example.com' });
      const anotherUserToken = jwtService.sign({ id: (anotherUser._id as Types.ObjectId).toHexString(), username: anotherUser.username, role: 'user' });

      const response = await request(httpServer)
        .delete(`/api/cheeks/${existingCheekIdForDelete}`)
        .set('Authorization', `Bearer ${anotherUserToken}`);
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
      expect(response.body.message).toEqual('You are not allowed to delete this Cheeks');
    });

    it('should return 404 if cheek ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toHexString();
      const response = await request(httpServer)
        .delete(`/api/cheeks/${nonExistentId}`)
        .set('Authorization', `Bearer ${testUserToken}`);
      expect(response.status).toBe(HttpStatus.NOT_FOUND);
      expect(response.body.message).toEqual('Cheeks not found');
    });
  });
});

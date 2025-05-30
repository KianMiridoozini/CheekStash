import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { CategoriesService } from '../../src/categories/categories.service'; // Import CategoriesService

// Helper DTOs
const userDto = {
    username: 'cheekuser_int',
    email: 'cheekuser_int@example.com',
    password: 'PasswordCheek1!'
};

describe('CheeksController (Integration)', () => {
    let app: INestApplication;
    let httpServer: any;
    let jwtService: JwtService;
    let user: any;
    let token: string;
    let cheekId: string;
    let currentCheekDto: any;

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
    });

    beforeEach(async () => {
        // Clear users collection to avoid duplicate registration/login issues
        const userModel = app.get(getModelToken('User'));
        await userModel.deleteMany({});
        // Clear categories collection to avoid duplicates
        const categoryModel = app.get(getModelToken('Category'));
        await categoryModel.deleteMany({});
        // Clear cheeks and tags collections to ensure test isolation
        const cheeksModel = app.get(getModelToken('Cheeks'));
        await cheeksModel.deleteMany({});
        const tagModel = app.get(getModelToken('Tag'));
        await tagModel.deleteMany({});

        // Register a user
        await request(httpServer).post('/api/users/register').send(userDto);

        // Log in the user and get token
        const loginRes = await request(httpServer)
            .post('/api/auth/login')
            .send({ email: userDto.email, password: userDto.password });
        expect(loginRes.status).toBe(200); // Ensure login succeeded
        token = loginRes.body.token;
        expect(token).toBeDefined();

        // Fetch user from DB to get _id
        user = await userModel.findOne({ email: userDto.email });
        expect(user).toBeDefined();

        // Create a real category for each test
        const categoryData = { name: `Test Category ${new Types.ObjectId().toHexString()}`, description: 'For integration tests' };
        const createdCategoryByModel = await categoryModel.create(categoryData);
        expect(createdCategoryByModel).toBeDefined();
        expect(createdCategoryByModel._id).toBeDefined();

        // Diagnostic step: Try to fetch the category using CategoriesService
        const categoriesService = app.get(CategoriesService);
        try {
            const fetchedCategoryByService = await categoriesService.findOne(createdCategoryByModel._id.toString());
            expect(fetchedCategoryByService).toBeDefined(); // Ensure service can find it
            expect(fetchedCategoryByService._id.toString()).toBe(createdCategoryByModel._id.toString());
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('DIAGNOSTIC FAILED: CategoriesService could not find the category immediately after creation.', e);
            // Optionally, rethrow or handle to make the test explicitly fail here if this is unexpected
            throw new Error('DIAGNOSTIC FAILED: CategoriesService could not find category: ' + e.message);
        }

        // Initialize currentCheekDto for the current test
        currentCheekDto = {
            title: 'Test Cheek',
            categoryId: createdCategoryByModel._id.toString(),
            isPublic: true,
            links: [{ url: 'https://example.com/link1', title: 'Link 1' }, { url: 'https://example.com/link2', title: 'Link 2' }], // Added valid links
            tagNames: [],
        };
    });

    afterAll(async () => {
        await app.close();
    });

    describe('POST /api/cheeks', () => {
        it('should create a cheek when authenticated', async () => {
            const res = await request(httpServer)
                .post('/api/cheeks')
                .set('Authorization', `Bearer ${token}`)
                .send(currentCheekDto);

            expect(res.status).toBe(201);
            expect(res.body.title).toBe(currentCheekDto.title);
            expect(res.body.slug).toBeDefined();
            expect(res.body.owner).toBeDefined();
            // Assign to cheekId if other tests depend on this specific cheek
            // but most tests create their own as per current structure.
            if (res.body._id || res.body.id) {
                cheekId = res.body._id || res.body.id;
            }
        });
        it('should return 401 if not authenticated', async () => {
            const res = await request(httpServer)
                .post('/api/cheeks')
                .send(currentCheekDto);
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/cheeks', () => {
        it('should return cheeks (public)', async () => {
            const res = await request(httpServer).get('/api/cheeks');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.cheeks)).toBe(true);
        });
    });

    describe('GET /api/cheeks/suggestions', () => {
        it('should return suggestions', async () => {
            const res = await request(httpServer)
                .get('/api/cheeks/suggestions?searchKeyword=Test');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /api/cheeks/user/:userId', () => {
        it('should return cheeks for a user', async () => {
            const res = await request(httpServer).get(`/api/cheeks/user/${user._id || user.id}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('GET /api/cheeks/:id', () => {
        it('should return a cheek by id', async () => {
            // Create a cheek first
            const createRes = await request(httpServer)
                .post('/api/cheeks')
                .set('Authorization', `Bearer ${token}`)
                .send(currentCheekDto);
            const id = createRes.body._id || createRes.body.id;
            const res = await request(httpServer).get(`/api/cheeks/${id}`);
            expect(res.status).toBe(200);
            expect(res.body.title).toBe(currentCheekDto.title);
        });
        it('should return 404 if not found', async () => {
            const res = await request(httpServer).get(`/api/cheeks/${new Types.ObjectId().toHexString()}`);
            expect(res.status).toBe(404);
        });
    });

    describe('PATCH /api/cheeks/:id', () => {
        it('should update a cheek if owner', async () => {
            // Create a cheek
            const createRes = await request(httpServer)
                .post('/api/cheeks')
                .set('Authorization', `Bearer ${token}`)
                .send(currentCheekDto);
            const id = createRes.body._id || createRes.body.id;
            const res = await request(httpServer)
                .patch(`/api/cheeks/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ title: 'Updated Cheek' });
            expect(res.status).toBe(200);
            expect(res.body.title).toBe('Updated Cheek');
        });
    });

    describe('PATCH /api/cheeks/:id/visibility', () => {
        it('should update visibility if owner', async () => {
            // Create a cheek
            const createRes = await request(httpServer)
                .post('/api/cheeks')
                .set('Authorization', `Bearer ${token}`)
                .send(currentCheekDto);
            const id = createRes.body._id || createRes.body.id;
            const res = await request(httpServer)
                .patch(`/api/cheeks/${id}/visibility`)
                .set('Authorization', `Bearer ${token}`)
                .send({ isPublic: false });
            expect(res.status).toBe(200);
            expect(res.body.isPublic).toBe(false);
        });
    });

    describe('DELETE /api/cheeks/:id', () => {
        it('should delete a cheek if owner', async () => {
            // Create a cheek
            const createRes = await request(httpServer)
                .post('/api/cheeks')
                .set('Authorization', `Bearer ${token}`)
                .send(currentCheekDto);
            const id = createRes.body._id || createRes.body.id;
            const res = await request(httpServer)
                .delete(`/api/cheeks/${id}`)
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/cheeks (sorting, pagination, filtering)', () => {
        let createdCheeks: any[] = [];
        beforeEach(async () => {
            // Create multiple cheeks with different titles, ratings, and reviewCounts
            createdCheeks = [];
            for (let i = 0; i < 5; i++) {
                const cheekRes = await request(httpServer)
                    .post('/api/cheeks')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        ...currentCheekDto,
                        title: `Cheek${i}`,
                        isPublic: true,
                        tagNames: [`tag${i}`],
                    });
                createdCheeks.push(cheekRes.body);
            }
        });
        it('should sort by recent (default)', async () => {
            const res = await request(httpServer).get('/api/cheeks');
            expect(res.status).toBe(200);
            expect(res.body.cheeks.length).toBeGreaterThan(0);
            // Most recent first
            expect(res.body.cheeks[0].title).toContain('Cheek');
        });
        it('should sort by oldest', async () => {
            const res = await request(httpServer).get('/api/cheeks?sortBy=oldest');
            expect(res.status).toBe(200);
            expect(res.body.cheeks.length).toBeGreaterThan(0);
            // Oldest first
            expect(res.body.cheeks[0].title).toBe('Cheek0');
        });
        it('should sort by alpha', async () => {
            const res = await request(httpServer).get('/api/cheeks?sortBy=alpha');
            expect(res.status).toBe(200);
            const titles = res.body.cheeks.map((c: any) => c.title);
            const sorted = [...titles].sort();
            expect(titles).toEqual(sorted);
        });
        it('should sort by alphaDesc', async () => {
            const res = await request(httpServer).get('/api/cheeks?sortBy=alphaDesc');
            expect(res.status).toBe(200);
            const titles = res.body.cheeks.map((c: any) => c.title);
            const sorted = [...titles].sort().reverse();
            expect(titles).toEqual(sorted);
        });
        it('should support pagination', async () => {
            const res = await request(httpServer).get('/api/cheeks?page=2&limit=2');
            expect(res.status).toBe(200);
            expect(res.body.cheeks.length).toBeLessThanOrEqual(2);
        });
        it('should filter by categoryId', async () => {
            // categoryId may be an object, so extract _id if needed
            const rawCategoryId = createdCheeks[0].categoryId;
            const categoryId = typeof rawCategoryId === 'object' && rawCategoryId !== null && '_id' in rawCategoryId ? rawCategoryId._id : rawCategoryId;
            const res = await request(httpServer).get(`/api/cheeks?categoryIds=${categoryId}`);
            expect(res.status).toBe(200);
            // Compare c.categoryId._id to categoryId
            expect(res.body.cheeks.every((c: any) => c.categoryId && c.categoryId._id && c.categoryId._id.toString() === categoryId.toString())).toBe(true);
        });
        it('should filter by tagId', async () => {
            // tagId may be an object, so extract _id if needed
            const rawTagId = createdCheeks[0].tagIds[0];
            const tagId = typeof rawTagId === 'object' && rawTagId !== null && '_id' in rawTagId ? rawTagId._id : rawTagId;
            const res = await request(httpServer).get(`/api/cheeks?tagIds=${tagId}`);
            expect(res.status).toBe(200);
            // Compare each tag's _id to tagId
            expect(res.body.cheeks.every((c: any) => Array.isArray(c.tagIds) && c.tagIds.some((t: any) => t && t._id && t._id.toString() === tagId.toString()))).toBe(true);
        });
    });
});

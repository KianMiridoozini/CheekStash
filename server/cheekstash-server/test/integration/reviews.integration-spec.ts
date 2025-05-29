import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import { CheeksDocument } from '../../src/cheeks/schemas/cheek.schema';
import { Review } from '../../src/reviews/schemas/review.schema';
import * as bcrypt from 'bcrypt';

describe('ReviewsController (Integration)', () => {
    let app: INestApplication;
    let httpServer: any;
    let jwtService: JwtService;
    let userModel: Model<UserDocument>;
    let cheekModel: Model<CheeksDocument>;
    let reviewModel: Model<any>;
    let user: any;
    let userToken: string;
    let otherUser: any;
    let otherUserToken: string;
    let cheek: any;

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
        cheekModel = moduleFixture.get(getModelToken('Cheeks'));
        reviewModel = moduleFixture.get(getModelToken(Review.name));
    });

    beforeEach(async () => {
        await userModel.deleteMany({});
        await cheekModel.deleteMany({});
        await reviewModel.deleteMany({});
        // Create two users
        const hash1 = await bcrypt.hash('Password1!', 10);
        user = await userModel.create({ username: 'reviewer', email: 'reviewer@example.com', passwordHash: hash1, role: 'user' });
        userToken = jwtService.sign({ id: user._id.toString(), username: user.username, role: 'user' });
        const hash2 = await bcrypt.hash('Password2!', 10);
        otherUser = await userModel.create({ username: 'cheekowner', email: 'cheekowner@example.com', passwordHash: hash2, role: 'user' });
        otherUserToken = jwtService.sign({ id: otherUser._id.toString(), username: otherUser.username, role: 'user' });
        // Create a public cheek owned by otherUser
        cheek = await cheekModel.create({
            title: 'Test Cheek',
            slug: 'test-cheek',
            owner: otherUser._id, // Store as ObjectId
            isPublic: true,
            categoryId: new Types.ObjectId(),
            links: [],
            tagIds: [],
        });
    });

    afterAll(async () => {
        await userModel.deleteMany({});
        await cheekModel.deleteMany({});
        await reviewModel.deleteMany({});
        await app.close();
    });

    describe('POST /api/reviews', () => {
        it('should create a review for a cheek by a non-owner', async () => {
            const dto = { cheekId: cheek._id.toString(), rating: 4, review: 'Great cheek!' };
            const res = await request(httpServer)
                .post('/api/reviews')
                .set('Authorization', `Bearer ${userToken}`)
                .send(dto);
            expect(res.status).toBe(201);
            expect(res.body.cheekId).toBe(cheek._id.toString());
            expect(res.body.rating).toBe(4);
            expect(res.body.review).toBe('Great cheek!');
            expect(res.body.user.username).toBe(user.username);
        });
        it('should not allow the owner to review their own cheek', async () => {
            const dto = { cheekId: cheek._id.toString(), rating: 5, review: 'My own cheek' };
            const res = await request(httpServer)
                .post('/api/reviews')
                .set('Authorization', `Bearer ${otherUserToken}`)
                .send(dto);
            expect(res.status).toBe(403);
        });
        it('should not allow duplicate reviews by the same user', async () => {
            const dto = { cheekId: cheek._id.toString(), rating: 4, review: 'First review' };
            await request(httpServer)
                .post('/api/reviews')
                .set('Authorization', `Bearer ${userToken}`)
                .send(dto);
            const res = await request(httpServer)
                .post('/api/reviews')
                .set('Authorization', `Bearer ${userToken}`)
                .send(dto);
            expect([409, 500]).toContain(res.status); // 409 for conflict, 500 for db constraint
        });
        it('should return 401 if not authenticated', async () => {
            const dto = { cheekId: cheek._id.toString(), rating: 3, review: 'No auth' };
            const res = await request(httpServer)
                .post('/api/reviews')
                .send(dto);
            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/reviews/:cheekId', () => {
        it('should get all reviews for a cheek', async () => {
            await reviewModel.create({ cheekId: cheek._id, userId: user._id, username: user.username, rating: 5, review: 'Nice!', createdAt: new Date(), updatedAt: new Date() });
            const res = await request(httpServer)
                .get(`/api/reviews/${cheek._id}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.reviews)).toBe(true);
            expect(res.body.reviews.length).toBeGreaterThanOrEqual(1);
        });
        it('should return 403 for private cheek if not owner', async () => {
            const privateCheek = await cheekModel.create({
                title: 'Private Cheek',
                slug: 'private-cheek',
                owner: otherUser._id, // Store as ObjectId
                isPublic: false,
                categoryId: new Types.ObjectId(),
                links: [],
                tagIds: [],
            });
            const res = await request(httpServer)
                .get(`/api/reviews/${privateCheek._id}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/reviews/by-slug/:username/:cheekSlug', () => {
        it('should get reviews for a cheek by username and slug', async () => {
            await reviewModel.create({ cheekId: cheek._id, userId: user._id, username: user.username, rating: 5, review: 'Nice!', createdAt: new Date(), updatedAt: new Date() });
            const res = await request(httpServer)
                .get(`/api/reviews/by-slug/${otherUser.username}/${cheek.slug}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.reviews)).toBe(true);
            expect(res.body.reviews.length).toBeGreaterThanOrEqual(1);
        });
        it('should return 404 if cheek not found', async () => {
            const res = await request(httpServer)
                .get(`/api/reviews/by-slug/${otherUser.username}/not-a-real-slug`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/reviews/review/:reviewId', () => {
        it('should get a review by id', async () => {
            const review = await reviewModel.create({ cheekId: cheek._id, userId: user._id, username: user.username, rating: 5, review: 'Nice!', createdAt: new Date(), updatedAt: new Date() });
            const res = await request(httpServer)
                .get(`/api/reviews/review/${review._id}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(200);
            expect(res.body._id).toBe(review._id.toString());
        });
        it('should return 404 if review not found', async () => {
            const fakeId = new Types.ObjectId().toString();
            const res = await request(httpServer)
                .get(`/api/reviews/review/${fakeId}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(404);
        });
    });

    describe('PUT /api/reviews/:reviewId', () => {
        it('should update a review by owner', async () => {
            const review = await reviewModel.create({ cheekId: cheek._id, userId: user._id, username: user.username, rating: 3, review: 'Old', createdAt: new Date(), updatedAt: new Date() });
            const dto = { rating: 5, review: 'Updated!' };
            const res = await request(httpServer)
                .put(`/api/reviews/${review._id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send(dto);
            expect(res.status).toBe(200);
            expect(res.body.rating).toBe(5);
            expect(res.body.review).toBe('Updated!');
        });
        it('should not allow non-owner to update', async () => {
            const review = await reviewModel.create({ cheekId: cheek._id, userId: user._id, username: user.username, rating: 3, review: 'Old', createdAt: new Date(), updatedAt: new Date() });
            const dto = { rating: 2, review: 'Hacked!' };
            const res = await request(httpServer)
                .put(`/api/reviews/${review._id}`)
                .set('Authorization', `Bearer ${otherUserToken}`)
                .send(dto);
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/reviews/:reviewId', () => {
        it('should delete a review by owner', async () => {
            const review = await reviewModel.create({ cheekId: cheek._id, userId: user._id, username: user.username, rating: 3, review: 'To delete', createdAt: new Date(), updatedAt: new Date() });
            const res = await request(httpServer)
                .delete(`/api/reviews/${review._id}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/deleted/i);
        });
        it('should not allow non-owner to delete', async () => {
            const review = await reviewModel.create({ cheekId: cheek._id, userId: user._id, username: user.username, rating: 3, review: 'To delete', createdAt: new Date(), updatedAt: new Date() });
            const res = await request(httpServer)
                .delete(`/api/reviews/${review._id}`)
                .set('Authorization', `Bearer ${otherUserToken}`);
            expect(res.status).toBe(404);
        });
    });
});

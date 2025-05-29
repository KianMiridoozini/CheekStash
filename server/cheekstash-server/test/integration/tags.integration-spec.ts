import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { Tag } from '../../src/tags/schema/tag.schema';
import { User, UserDocument } from '../../src/users/schemas/user.schema';
import * as bcrypt from 'bcrypt';

describe('TagsController (Integration)', () => {
    let app: INestApplication;
    let httpServer: any;
    let jwtService: JwtService;
    let userModel: Model<UserDocument>;
    let tagModel: Model<any>;
    let adminToken: string;
    let userToken: string;
    let adminUser: any;
    let normalUser: any;

    const adminUserDto = {
        username: 'admintag',
        email: 'admintag@example.com',
        password: 'AdminTag123!',
        role: 'admin',
    };
    const userDto = {
        username: 'usertag',
        email: 'usertag@example.com',
        password: 'UserTag123!',
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
        tagModel = moduleFixture.get(getModelToken(Tag.name));
    });

    beforeEach(async () => {
        await userModel.deleteMany({});
        await tagModel.deleteMany({});
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
        await tagModel.deleteMany({});
        await app.close();
    });

    describe('POST /api/tags', () => {
        it('should create a tag as admin', async () => {
            const dto = { name: 'testtag' };
            const res = await request(httpServer)
                .post('/api/tags')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(dto);
            expect(res.status).toBe(201);
            expect(res.body.name).toBe(dto.name.toLowerCase());
        });
        it('should return 401 if not authenticated', async () => {
            const dto = { name: 'NoAuthTag' };
            const res = await request(httpServer)
                .post('/api/tags')
                .send(dto);
            expect(res.status).toBe(401);
        });
        it('should return 403 if not admin', async () => {
            const dto = { name: 'usertag' };
            const res = await request(httpServer)
                .post('/api/tags')
                .set('Authorization', `Bearer ${userToken}`)
                .send(dto);
            expect(res.status).toBe(403);
        });
        it('should return 409 if tag name already exists', async () => {
            const dto = { name: 'duptag' };
            await tagModel.create({ name: dto.name.toLowerCase() });
            const res = await request(httpServer)
                .post('/api/tags')
                .set('Authorization', `Bearer ${adminToken}`)
                .send(dto);
            expect(res.status).toBe(409);
        });
    });

    describe('GET /api/tags', () => {
        it('should return all tags sorted by usageCount and name', async () => {
            await tagModel.create({ name: 'tagb', usageCount: 2 });
            await tagModel.create({ name: 'taga', usageCount: 2 });
            await tagModel.create({ name: 'tagc', usageCount: 1 });
            const res = await request(httpServer).get('/api/tags');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThanOrEqual(3);
            // usageCount desc, then name asc
            expect(res.body[0].usageCount).toBeGreaterThanOrEqual(res.body[1].usageCount);
        });
    });

    describe('GET /api/tags/find-by-name', () => {
        it('should return a tag by name', async () => {
            await tagModel.create({ name: 'findme' });
            const res = await request(httpServer).get('/api/tags/find-by-name?name=findme');
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('findme');
        });
        it('should return 404 if not found', async () => {
            const res = await request(httpServer).get('/api/tags/find-by-name?name=notfound');
            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/tags/:id', () => {
        it('should return a tag by id', async () => {
            const tag = await tagModel.create({ name: 'byidtag' });
            const res = await request(httpServer).get(`/api/tags/${tag._id}`);
            expect(res.status).toBe(200);
            expect(res.body.name).toBe(tag.name);
        });
        it('should return 404 if not found', async () => {
            const fakeId = '60c72b2f9b1e8e1a2c8f9e99';
            const res = await request(httpServer).get(`/api/tags/${fakeId}`);
            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/tags/:id', () => {
        it('should delete a tag as admin', async () => {
            const tag = await tagModel.create({ name: 'deltag' });
            const res = await request(httpServer)
                .delete(`/api/tags/${tag._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(204);
        });
        it('should return 401 if not authenticated', async () => {
            const tag = await tagModel.create({ name: 'delnoauth' });
            const res = await request(httpServer)
                .delete(`/api/tags/${tag._id}`);
            expect(res.status).toBe(401);
        });
        it('should return 403 if not admin', async () => {
            const tag = await tagModel.create({ name: 'deluser' });
            const res = await request(httpServer)
                .delete(`/api/tags/${tag._id}`)
                .set('Authorization', `Bearer ${userToken}`);
            expect(res.status).toBe(403);
        });
        it('should return 404 if not found', async () => {
            const fakeId = '60c72b2f9b1e8e1a2c8f9e99';
            const res = await request(httpServer)
                .delete(`/api/tags/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(404);
        });
    });
});

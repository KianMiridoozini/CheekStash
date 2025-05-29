import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { CloudinaryService } from '../common/cloudinary.service';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock models and services
function createMockModel() {
    // This is a constructor function
    const model: any = jest.fn((doc) => ({
        ...doc,
        save: jest.fn().mockResolvedValue({
            ...doc,
            toObject: jest.fn().mockReturnValue(doc),
        }),
    }));
    // Static methods
    model.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn() });
    model.findById = jest.fn().mockReturnValue({ exec: jest.fn() });
    model.find = jest.fn().mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn() });
    model.findByIdAndDelete = jest.fn().mockReturnValue({ exec: jest.fn() });
    model.aggregate = jest.fn();
    model.deleteMany = jest.fn();
    model.collection = { name: 'users' };
    return model;
}
const mockCheekModel = () => ({
    aggregate: jest.fn(),
    deleteMany: jest.fn(),
    collection: { name: 'cheeks' },
});
const mockReviewModel = () => ({
    deleteMany: jest.fn(),
    collection: { name: 'reviews' },
});
const mockCloudinaryService = {
    uploadImage: jest.fn(),
    deleteImage: jest.fn(),
};

jest.mock('bcrypt');

const userDocMock = (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: 'hashed',
    profile: { displayName: 'Test User', bio: 'bio', avatarUrl: 'url', profileImagePublicId: 'pid' },
    role: 'user',
    toObject: jest.fn().mockReturnValue({
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        email: 'test@example.com',
        profile: { displayName: 'Test User', bio: 'bio', avatarUrl: 'url', profileImagePublicId: 'pid' },
        role: 'user',
        ...overrides,
    }),
    markModified: jest.fn(),
    save: jest.fn(),
    ...overrides,
});

describe('UsersService', () => {
    let service: UsersService;
    let userModel: any;
    let cheekModel: any;
    let reviewModel: any;
    let cloudinaryService: any;

    beforeEach(async () => {
        const userModelMock = createMockModel();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: getModelToken('User'), useValue: userModelMock },
                { provide: getModelToken('Cheeks'), useFactory: mockCheekModel },
                { provide: getModelToken('Review'), useFactory: mockReviewModel },
                { provide: CloudinaryService, useValue: mockCloudinaryService },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        userModel = module.get(getModelToken('User'));
        cheekModel = module.get(getModelToken('Cheeks'));
        reviewModel = module.get(getModelToken('Review'));
        cloudinaryService = module.get(CloudinaryService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new user', async () => {
            userModel.findOne.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
            // Patch the constructor to return a mock with save
            userModel.mockImplementation((doc) => ({
                ...userDocMock(doc),
                save: jest.fn().mockResolvedValue(userDocMock(doc)),
            }));
            const result = await service.create({ username: 'TestUser', email: 'test@example.com', password: 'pw' });
            expect(result.username).toBe('testuser');
            expect(result.email).toBe('test@example.com');
        });
        it('should throw if username or email taken', async () => {
            userModel.findOne.mockResolvedValue({ email: 'test@example.com', username: 'testuser' });
            await expect(service.create({ username: 'TestUser', email: 'test@example.com', password: 'pw' })).rejects.toThrow(BadRequestException);
        });
    });

    describe('findByEmail', () => {
        it('should find user by email', async () => {
            userModel.findOne.mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(userDocMock()) });
            const result = await service.findByEmail('test@example.com');
            expect(result).toBeDefined();
        });
    });

    describe('changePassword', () => {
        it('should change password if old password matches', async () => {
            userModel.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(userDocMock({ passwordHash: 'oldhash', save: jest.fn() })) });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');
            const result = await service.changePassword('507f1f77bcf86cd799439011', { oldPassword: 'old', newPassword: 'new' });
            expect(result.message).toBe('Password updated successfully.');
        });
        it('should throw if old password is wrong', async () => {
            userModel.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(userDocMock({ passwordHash: 'oldhash' })) });
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            await expect(service.changePassword('507f1f77bcf86cd799439011', { oldPassword: 'bad', newPassword: 'new' })).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('updateProfile', () => {
        it('should update displayName and bio', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock({ profile: { displayName: 'Old', bio: 'Old bio' }, save: jest.fn().mockResolvedValue(userDocMock({ profile: { displayName: 'New', bio: 'New bio' } })) })) });
            const result = await service.updateProfile('507f1f77bcf86cd799439011', { displayName: 'New', bio: 'New bio' }, { id: '507f1f77bcf86cd799439011', role: 'user' });
            expect(result.profile.displayName).toBe('New');
            expect(result.profile.bio).toBe('New bio');
        });
        it('should throw Forbidden if not self or admin', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock()) });
            await expect(service.updateProfile('507f1f77bcf86cd799439011', { displayName: 'X' }, { id: 'other', role: 'user' })).rejects.toThrow(ForbiddenException);
        });
    });

    describe('uploadProfileImage', () => {
        it('should upload and set avatar', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock({ profile: {}, save: jest.fn().mockResolvedValue(userDocMock({ profile: { avatarUrl: 'url', profileImagePublicId: 'pid' } })) })) });
            cloudinaryService.uploadImage.mockResolvedValue({ secure_url: 'url', public_id: 'pid' });
            const file = { originalname: 'a.png', buffer: Buffer.from('') } as any;
            const result = await service.uploadProfileImage('507f1f77bcf86cd799439011', file);
            expect(result.profile.avatarUrl).toBe('url');
        });
        it('should throw if no file', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock()) });
            await expect(service.uploadProfileImage('507f1f77bcf86cd799439011', null as any)).rejects.toThrow(BadRequestException);
        });
    });

    describe('deleteAvatar', () => {
        it('should delete avatar if authorized', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock({ profile: { profileImagePublicId: 'pid' }, save: jest.fn().mockResolvedValue(userDocMock({ profile: {} })) })) });
            cloudinaryService.deleteImage.mockResolvedValue(undefined);
            const result = await service.deleteAvatar('507f1f77bcf86cd799439011', { id: '507f1f77bcf86cd799439011', role: 'user' });
            expect(result.profile.avatarUrl).toBeUndefined();
        });
        it('should throw Forbidden if not self or admin', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock()) });
            await expect(service.deleteAvatar('507f1f77bcf86cd799439011', { id: 'other', role: 'user' })).rejects.toThrow(ForbiddenException);
        });
    });

    describe('deleteUser', () => {
        it('should delete user and related data if password confirmed', async () => {
            userModel.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(userDocMock({ passwordHash: 'hash', _id: '507f1f77bcf86cd799439011' })) });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            cheekModel.deleteMany.mockResolvedValue({});
            reviewModel.deleteMany.mockResolvedValue({});
            userModel.findByIdAndDelete.mockResolvedValue({});
            const result = await service.deleteUser('507f1f77bcf86cd799439011', 'pw', { id: '507f1f77bcf86cd799439011', role: 'user' });
            expect(result.message).toMatch(/deleted/);
        });
        it('should throw Unauthorized if password wrong', async () => {
            userModel.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(userDocMock({ passwordHash: 'hash' })) });
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            await expect(service.deleteUser('507f1f77bcf86cd799439011', 'bad', { id: '507f1f77bcf86cd799439011', role: 'user' })).rejects.toThrow(UnauthorizedException);
        });
        it('should throw Forbidden if not self or admin', async () => {
            userModel.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(userDocMock()) });
            await expect(service.deleteUser('507f1f77bcf86cd799439011', 'pw', { id: 'other', role: 'user' })).rejects.toThrow(ForbiddenException);
        });
    });

    describe('searchByName', () => {
        it('should return users matching displayName or username', async () => {
            const users = [userDocMock({ username: 'foo', profile: { displayName: 'Bar' } })];
            userModel.find.mockReturnValue({ select: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(users) });
            const result = await service.searchByName('foo');
            expect(result.length).toBe(1);
            expect(result[0].username).toBe('foo');
        });
        it('should return empty array for empty query', async () => {
            const result = await service.searchByName('   ');
            expect(result).toEqual([]);
        });
    });

    describe('findByCheekCount', () => {
        it('should return users with cheek count >= min', async () => {
            const users = [userDocMock({ username: 'cheeky' })];
            cheekModel.aggregate.mockResolvedValue(users);
            const result = await service.findByCheekCount(1);
            expect(result.length).toBe(1);
            expect(result[0].username).toBe('cheeky');
        });
        it('should throw for negative min', async () => {
            await expect(service.findByCheekCount(-1)).rejects.toThrow(BadRequestException);
        });
    });

    describe('updateUserRole', () => {
        // Use valid ObjectId strings for mock IDs
        const validAdminId = '507f1f77bcf86cd799439011'; // Example valid ObjectId
        const validTargetUserId = '507f1f77bcf86cd799439012'; // Example valid ObjectId
        const validOtherAdminId = '507f1f77bcf86cd799439013'; // Example valid ObjectId

        const adminRequester = { id: validAdminId, role: 'admin' as const };
        // targetUserId will now be validTargetUserId for most tests

        it('should update user role when called by an admin for another user', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock({ _id: validTargetUserId, role: 'user', save: jest.fn().mockResolvedValue(userDocMock({ _id: validTargetUserId, role: 'admin' })) })) });
            const result = await service.updateUserRole(validTargetUserId, 'admin', adminRequester);
            expect(result.role).toBe('admin');
            expect(userModel.findById).toHaveBeenCalledWith(validTargetUserId);
        });

        it('should allow an admin to change another admin\'s role', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock({ _id: validOtherAdminId, role: 'admin', save: jest.fn().mockResolvedValue(userDocMock({ _id: validOtherAdminId, role: 'user' })) })) });
            const result = await service.updateUserRole(validOtherAdminId, 'user', adminRequester);
            expect(result.role).toBe('user');
        });

        it('should throw BadRequestException if an admin tries to change their own role', async () => {
            // adminRequester.id (validAdminId) is a valid ObjectId, so the service method will proceed past the ID format check.
            await expect(service.updateUserRole(adminRequester.id, 'user', adminRequester)).rejects.toThrow(BadRequestException);
            await expect(service.updateUserRole(adminRequester.id, 'user', adminRequester))
                .rejects
                .toThrow('Admins cannot change their own role using this endpoint.');
            expect(userModel.findById).not.toHaveBeenCalled(); 
        });

        it('should throw BadRequestException if user already has the target role', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(userDocMock({ _id: validTargetUserId, role: 'admin' })) });
            await expect(service.updateUserRole(validTargetUserId, 'admin', adminRequester)).rejects.toThrow(BadRequestException);
            await expect(service.updateUserRole(validTargetUserId, 'admin', adminRequester))
                .rejects
                .toThrow("User already has the role 'admin'.");
        });

        it('should throw BadRequestException for invalid target user ID format', async () => {
            // This test correctly uses an invalid ID format
            await expect(service.updateUserRole('invalidUserIdFormat', 'admin', adminRequester)).rejects.toThrow(BadRequestException);
            await expect(service.updateUserRole('invalidUserIdFormat', 'admin', adminRequester))
                .rejects
                .toThrow('Invalid target user ID format.');
        });

        it('should throw NotFoundException if target user is not found', async () => {
            userModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            await expect(service.updateUserRole(validTargetUserId, 'admin', adminRequester)).rejects.toThrow('User not found');
        });
    });
});
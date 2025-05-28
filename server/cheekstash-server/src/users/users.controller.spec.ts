import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockUsersService = {
    findAll: jest.fn(),
    searchByName: jest.fn(),
    findUserByUsername: jest.fn(),
    findByCheekCount: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateProfile: jest.fn(),
    uploadProfileImage: jest.fn(),
    deleteAvatar: jest.fn(),
    updateUserRole: jest.fn(),
    deleteUser: jest.fn(),
};

describe('UsersController', () => {
    let controller: UsersController;
    let service: typeof mockUsersService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                { provide: UsersService, useValue: mockUsersService },
            ],
        }).compile();
        controller = module.get<UsersController>(UsersController);
        service = module.get(UsersService);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAllUsers', () => {
        it('should return all users', async () => {
            service.findAll.mockResolvedValue(['user']);
            expect(await controller.findAllUsers()).toEqual(['user']);
        });
    });

    describe('searchUsers', () => {
        it('should call service with name', async () => {
            service.searchByName.mockResolvedValue(['user']);
            expect(await controller.searchUsers('foo')).toEqual(['user']);
        });
        it('should throw if no name', async () => {
            await expect(controller.searchUsers('')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findUserByUsername', () => {
        it('should return user if found', async () => {
            service.findUserByUsername.mockResolvedValue({ username: 'foo' });
            expect(await controller.findUserByUsername('foo')).toEqual({ username: 'foo' });
        });
        it('should throw if not found', async () => {
            service.findUserByUsername.mockResolvedValue(null);
            await expect(controller.findUserByUsername('foo')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findUsersByCheekCount', () => {
        it('should call service with parsed min', async () => {
            service.findByCheekCount.mockResolvedValue(['user']);
            expect(await controller.findUsersByCheekCount('2')).toEqual(['user']);
        });
    });

    describe('findUserById', () => {
        it('should call service with id', async () => {
            service.findById.mockResolvedValue({ id: '1' });
            expect(await controller.findUserById('1')).toEqual({ id: '1' });
        });
    });

    describe('register', () => {
        it('should call service.create', async () => {
            service.create.mockResolvedValue({ id: '1' });
            expect(await controller.register({ username: 'a', email: 'b', password: 'c' })).toEqual({ id: '1' });
        });
    });

    describe('updateProfile', () => {
        it('should call service.updateProfile and map response', async () => {
            service.updateProfile.mockResolvedValue({
                id: '1', username: 'u', email: 'e', profile: { displayName: 'd', bio: 'b', avatarUrl: 'a' }, role: 'user',
            });
            const req = { user: { id: '1', role: 'user' } };
            const dto = { displayName: 'd', bio: 'b' };
            const result = await controller.updateProfile(dto, req);
            expect(result).toEqual({
                id: '1', username: 'u', email: 'e', displayName: 'd', bio: 'b', avatarUrl: 'a', role: 'user',
            });
        });
    });

    describe('uploadProfileImage', () => {
        it('should call service.uploadProfileImage and map response', async () => {
            service.uploadProfileImage.mockResolvedValue({
                id: '1', username: 'u', email: 'e', profile: { displayName: 'd', bio: 'b', avatarUrl: 'a' }, role: 'user',
            });
            const req = { user: { id: '1', role: 'user' } };
            const file = { originalname: 'a.png' } as any;
            const result = await controller.uploadProfileImage(file, req);
            expect(result).toEqual({
                id: '1', username: 'u', email: 'e', displayName: 'd', bio: 'b', avatarUrl: 'a', role: 'user',
            });
        });
    });

    describe('deleteProfileImage', () => {
        it('should call service.deleteAvatar and map response', async () => {
            service.deleteAvatar.mockResolvedValue({
                id: '1', username: 'u', email: 'e', profile: { displayName: 'd', bio: 'b', avatarUrl: undefined }, role: 'user',
            });
            const req = { user: { id: '1', role: 'user' } };
            const result = await controller.deleteProfileImage(req);
            expect(result).toEqual({
                id: '1', username: 'u', email: 'e', displayName: 'd', bio: 'b', avatarUrl: undefined, role: 'user',
            });
        });
    });

    describe('adminUpdateUserRole', () => {
        it('should call service.updateUserRole', async () => {
            service.updateUserRole.mockResolvedValue({ id: '1', role: 'admin' });
            const req = { user: { id: 'admin', role: 'admin' } };
            const dto = { role: 'admin' as 'admin' };
            const result = await controller.adminUpdateUserRole('1', dto, req);
            expect(result).toEqual({ id: '1', role: 'admin' });
        });
    });

    describe('adminDeleteUser', () => {
        it('should call service.deleteUser for admin', async () => {
            service.deleteUser.mockResolvedValue({ message: 'deleted' });
            const req = { user: { id: 'admin', role: 'admin' } };
            const result = await controller.adminDeleteUser('1', req);
            expect(result).toEqual({ message: 'deleted' });
        });
    });
});
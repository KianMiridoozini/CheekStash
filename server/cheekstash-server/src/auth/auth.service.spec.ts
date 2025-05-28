import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    changePassword: jest.fn(),
    deleteUser: jest.fn(),
};
const mockJwtService = {
    sign: jest.fn(),
};

jest.mock('bcrypt');

describe('AuthService', () => {
    let service: AuthService;
    let usersService: typeof mockUsersService;
    let jwtService: typeof mockJwtService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: mockUsersService },
                { provide: JwtService, useValue: mockJwtService },
            ],
        }).compile();
        service = module.get<AuthService>(AuthService);
        usersService = module.get(UsersService);
        jwtService = module.get(JwtService);
        jest.clearAllMocks();
    });

    describe('validateUser', () => {
        it('should return user if credentials valid', async () => {
            const user = { passwordHash: 'hash' };
            usersService.findByEmail.mockResolvedValue(user);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);
            const result = await service.validateUser('a@b.com', 'pw');
            expect(result).toBe(user);
        });
        it('should throw if user not found', async () => {
            usersService.findByEmail.mockResolvedValue(null);
            await expect(service.validateUser('a@b.com', 'pw')).rejects.toThrow(NotFoundException);
        });
        it('should throw if password invalid', async () => {
            const user = { passwordHash: 'hash' };
            usersService.findByEmail.mockResolvedValue(user);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);
            await expect(service.validateUser('a@b.com', 'pw')).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('login', () => {
        it('should return token and username', async () => {
            jwtService.sign.mockReturnValue('jwt');
            const user = { _id: '1', username: 'u', role: 'user' };
            const result = await service.login(user as any);
            expect(result).toEqual({ token: 'jwt', username: 'u' });
            expect(jwtService.sign).toHaveBeenCalledWith({ id: '1', username: 'u', role: 'user' });
        });
    });

    describe('getUserProfile', () => {
        it('should return user profile', async () => {
            const user = { id: '1', username: 'u' };
            usersService.findById.mockResolvedValue(user);
            const result = await service.getUserProfile('1');
            expect(result).toBe(user);
        });
        it('should throw if user not found', async () => {
            usersService.findById.mockResolvedValue(null);
            await expect(service.getUserProfile('1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('changePassword', () => {
        it('should call usersService.changePassword', async () => {
            usersService.changePassword.mockResolvedValue({ message: 'ok' });
            const result = await service.changePassword('1', { oldPassword: 'a', newPassword: 'b' });
            expect(result).toEqual({ message: 'ok' });
        });
    });

    describe('deleteUser', () => {
        it('should call usersService.deleteUser', async () => {
            usersService.deleteUser.mockResolvedValue({ message: 'deleted' });
            const requester = { id: '1', role: 'user' };
            const result = await service.deleteUser(requester, 'pw');
            expect(result).toEqual({ message: 'deleted' });
            expect(usersService.deleteUser).toHaveBeenCalledWith('1', 'pw', requester);
        });
    });
});
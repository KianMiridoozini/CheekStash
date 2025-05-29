import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    getUserProfile: jest.fn(),
    changePassword: jest.fn(),
    deleteUser: jest.fn(),
};

describe('AuthController', () => {
    let controller: AuthController;
    let service: typeof mockAuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [
                { provide: AuthService, useValue: mockAuthService },
            ],
        }).compile();
        controller = module.get<AuthController>(AuthController);
        service = module.get(AuthService);
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should validate and login user', async () => {
            service.validateUser.mockResolvedValue({ id: '1' });
            service.login.mockResolvedValue({ token: 'jwt', username: 'u' });
            const dto = { email: 'a@b.com', password: 'pw' };
            const result = await controller.login(dto);
            expect(service.validateUser).toHaveBeenCalledWith('a@b.com', 'pw');
            expect(service.login).toHaveBeenCalledWith({ id: '1' });
            expect(result).toEqual({ token: 'jwt', username: 'u' });
        });
    });

    describe('getProfile', () => {
        it('should return user profile if authenticated', async () => {
            service.getUserProfile.mockResolvedValue({ id: '1', username: 'u' });
            const req = { user: { id: '1' } };
            const result = await controller.getProfile(req);
            expect(result).toEqual({ id: '1', username: 'u' });
        });
        it('should throw if not authenticated', async () => {
            await expect(controller.getProfile({})).rejects.toThrow(UnauthorizedException);
        });
    });

    describe('changePassword', () => {
        it('should call service.changePassword', async () => {
            service.changePassword.mockResolvedValue({ message: 'ok' });
            const req = { user: { id: '1' } };
            const dto = { oldPassword: 'a', newPassword: 'b' };
            const result = await controller.changePassword(dto, req);
            expect(service.changePassword).toHaveBeenCalledWith('1', dto);
            expect(result).toEqual({ message: 'ok' });
        });
    });

    describe('deleteAccount', () => {
        it('should call service.deleteUser', async () => {
            service.deleteUser.mockResolvedValue({ message: 'deleted' });
            const req = { user: { id: '1', role: 'user' } };
            const dto = { password: 'pw' };
            const result = await controller.deleteAccount(req, dto);
            expect(service.deleteUser).toHaveBeenCalledWith(req.user, 'pw');
            expect(result).toEqual({ message: 'deleted' });
        });
        it('should throw if not authenticated', async () => {
            await expect(controller.deleteAccount({}, { password: 'pw' })).rejects.toThrow(UnauthorizedException);
        });
    });
});
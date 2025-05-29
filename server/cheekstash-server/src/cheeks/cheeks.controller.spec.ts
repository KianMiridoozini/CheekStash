import { Test, TestingModule } from '@nestjs/testing';
import { CheeksController } from './cheeks.controller';
import { CheeksService } from './cheeks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CheekVisibilityGuard } from '../common/guards/cheek-visibility.guard';
import { BadRequestException } from '@nestjs/common';

describe('CheeksController', () => {
    let controller: CheeksController;
    let cheeksService: any;

    const mockCheeksService = {
        createCheeks: jest.fn(),
        getCheeksPaginated: jest.fn(),
        getCheekSuggestions: jest.fn(),
        getCheeksByUserId: jest.fn(),
        findCheekByUsernameAndSlug: jest.fn(),
        getCheeksById: jest.fn(),
        updateCheeks: jest.fn(),
        updateCheekVisibility: jest.fn(),
        deleteCheeks: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CheeksController],
            providers: [
                { provide: CheeksService, useValue: mockCheeksService },
            ],
        })
            .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
            .overrideGuard(OptionalJwtAuthGuard).useValue({ canActivate: () => true })
            .overrideGuard(CheekVisibilityGuard).useValue({ canActivate: () => true })
            .compile();

        controller = module.get<CheeksController>(CheeksController);
        cheeksService = module.get<CheeksService>(CheeksService);
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should call cheeksService.createCheeks with correct params', async () => {
            const dto = {
                title: 'T',
                categoryId: '507f1f77bcf86cd799439011',
                isPublic: true,
                links: [],
                tagNames: [],
            };
            const req = { user: { id: 'user1' } };
            cheeksService.createCheeks.mockResolvedValue({ id: '1', ...dto });
            const result = await controller.create(dto, req);
            expect(cheeksService.createCheeks).toHaveBeenCalledWith(dto, 'user1');
            expect(result).toEqual({ id: '1', ...dto });
        });
    });

    describe('findAll', () => {
        it('should call cheeksService.getCheeksPaginated', async () => {
            const query = { page: 1 };
            const req = { user: { id: 'user1' } };
            cheeksService.getCheeksPaginated.mockResolvedValue(['cheek1']);
            const result = await controller.findAll(query, req);
            expect(cheeksService.getCheeksPaginated).toHaveBeenCalledWith(query, 'user1');
            expect(result).toEqual(['cheek1']);
        });
    });

    describe('getSuggestions', () => {
        it('should call cheeksService.getCheekSuggestions', async () => {
            const query = { searchKeyword: 'foo' };
            const req = { user: { id: 'user1' } };
            cheeksService.getCheekSuggestions.mockResolvedValue(['suggestion']);
            const result = await controller.getSuggestions(query, req);
            expect(cheeksService.getCheekSuggestions).toHaveBeenCalledWith(query, 'user1');
            expect(result).toEqual(['suggestion']);
        });
    });

    describe('findCheeksByUserId', () => {
        it('should call cheeksService.getCheeksByUserId', async () => {
            const req = { user: { id: 'user1' } };
            cheeksService.getCheeksByUserId.mockResolvedValue(['cheek']);
            const result = await controller.findCheeksByUserId('user2', req);
            expect(cheeksService.getCheeksByUserId).toHaveBeenCalledWith('user2', 'user1');
            expect(result).toEqual(['cheek']);
        });
    });

    describe('findByUsernameAndSlug', () => {
        it('should throw BadRequestException if username or slug missing', async () => {
            await expect(controller.findByUsernameAndSlug('', 'slug', { user: { id: 'u' } })).rejects.toThrow(BadRequestException);
            await expect(controller.findByUsernameAndSlug('user', '', { user: { id: 'u' } })).rejects.toThrow(BadRequestException);
        });
        it('should call cheeksService.findCheekByUsernameAndSlug', async () => {
            cheeksService.findCheekByUsernameAndSlug.mockResolvedValue('cheek');
            const req = { user: { id: 'user1' } };
            const result = await controller.findByUsernameAndSlug('user', 'slug', req);
            expect(cheeksService.findCheekByUsernameAndSlug).toHaveBeenCalledWith('user', 'slug', 'user1');
            expect(result).toBe('cheek');
        });
    });

    describe('findOne', () => {
        it('should call cheeksService.getCheeksById', async () => {
            cheeksService.getCheeksById.mockResolvedValue('cheek');
            const req = { user: { id: 'user1' } };
            const result = await controller.findOne('id1', req);
            expect(cheeksService.getCheeksById).toHaveBeenCalledWith('id1', 'user1');
            expect(result).toBe('cheek');
        });
    });

    describe('update', () => {
        it('should call cheeksService.updateCheeks', async () => {
            cheeksService.updateCheeks.mockResolvedValue('updated');
            const req = { user: { id: 'user1' } };
            const dto = { title: 'new' };
            const result = await controller.update('id1', dto, req);
            expect(cheeksService.updateCheeks).toHaveBeenCalledWith('id1', dto, 'user1');
            expect(result).toBe('updated');
        });
    });

    describe('updateVisibility', () => {
        it('should call cheeksService.updateCheekVisibility', async () => {
            cheeksService.updateCheekVisibility.mockResolvedValue('vis-updated');
            const req = { user: { id: 'user1' } };
            const dto = { isPublic: false };
            const result = await controller.updateVisibility('id1', dto, req);
            expect(cheeksService.updateCheekVisibility).toHaveBeenCalledWith('id1', dto, 'user1');
            expect(result).toBe('vis-updated');
        });
    });

    describe('remove', () => {
        it('should call cheeksService.deleteCheeks', async () => {
            cheeksService.deleteCheeks.mockResolvedValue('deleted');
            const req = { user: { id: 'user1' } };
            const result = await controller.remove('id1', req);
            expect(cheeksService.deleteCheeks).toHaveBeenCalledWith('id1', 'user1');
            expect(result).toBe('deleted');
        });
    });
});

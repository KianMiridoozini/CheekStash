import { Test, TestingModule } from '@nestjs/testing';
import { CheeksService } from './cheeks.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import * as mongoose from 'mongoose';
import { CategoriesService } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';
import { UsersService } from '../users/users.service';

const mockCheeksModel = () => ({
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
});
const mockReviewModel = () => ({
    aggregate: jest.fn(),
});
const mockCategoriesService = {
    findOne: jest.fn(),
};
const mockTagsService = {
    findOrCreateTags: jest.fn(),
};
const mockUsersService = {
    findUserByUsername: jest.fn(),
};

const cheekDocMock = (overrides = {}) => ({
    _id: '507f1f77bcf86cd799439011',
    title: 'Cheek',
    slug: 'cheek',
    owner: { _id: 'user1', toString: () => 'user1' },
    isPublic: true,
    tagIds: [],
    save: jest.fn(),
    populate: jest.fn().mockResolvedValue({}),
    ...overrides,
});

const reviewStats = [{ _id: null, averageRating: 4.5, reviewCount: 2 }];

// Patch only the methods you need for your tests:
beforeAll(() => {
    // Patch only ObjectId.isValid, not the whole ObjectId
    (mongoose.Types.ObjectId as any).isValid = (id: any) => id && id.length >= 8;
});
afterAll(() => {
    // Clean up the patch
    delete (mongoose.Types.ObjectId as any).isValid;
});

// Create a mock constructor for CheeksModel and attach static methods using Object.assign
const CheeksModelMock = jest.fn().mockImplementation((data) => ({
    ...cheekDocMock(data),
    save: jest.fn().mockResolvedValue(cheekDocMock(data)),
    populate: jest.fn().mockResolvedValue(cheekDocMock(data)),
}));
Object.assign(CheeksModelMock, {
    findById: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
});

describe('CheeksService', () => {
    let service: CheeksService;
    let CheeksModel: any;
    let reviewModel: any;
    let categoriesService: any;
    let tagsService: any;
    let usersService: any;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CheeksService,
                { provide: getModelToken('Cheeks'), useValue: CheeksModelMock },
                { provide: getModelToken('Review'), useFactory: mockReviewModel },
                { provide: CategoriesService, useValue: mockCategoriesService },
                { provide: TagsService, useValue: mockTagsService },
                { provide: UsersService, useValue: mockUsersService },
            ],
        }).compile();
        service = module.get<CheeksService>(CheeksService);
        CheeksModel = module.get(getModelToken('Cheeks'));
        reviewModel = module.get(getModelToken('Review'));
        categoriesService = module.get(CategoriesService);
        tagsService = module.get(TagsService);
        usersService = module.get(UsersService);
        jest.clearAllMocks();
    });

    describe('findCheekOwnerAndVisibility', () => {
        it('should return null for invalid id', async () => {
            const result = await service.findCheekOwnerAndVisibility('bad');
            expect(result).toBeNull();
        });
        it('should return owner and isPublic', async () => {
            CheeksModel.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue({ owner: { _id: 'user1' }, isPublic: true }) });
            const result = await service.findCheekOwnerAndVisibility('507f1f77bcf86cd799439011');
            expect(result).toEqual({ owner: { _id: 'user1' }, isPublic: true });
        });
    });

    describe('findCheekOwnerAndVisibilityBySlug', () => {
        it('should return null if user not found', async () => {
            usersService.findUserByUsername.mockResolvedValue(null);
            const result = await service.findCheekOwnerAndVisibilityBySlug('foo', 'slug');
            expect(result).toBeNull();
        });
        it('should return null if cheek not found', async () => {
            usersService.findUserByUsername.mockResolvedValue({ _id: 'user1' });
            CheeksModel.findOne.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(null) });
            const result = await service.findCheekOwnerAndVisibilityBySlug('foo', 'slug');
            expect(result).toBeNull();
        });
        it('should return owner and isPublic if found', async () => {
            usersService.findUserByUsername.mockResolvedValue({ _id: 'user1' });
            CheeksModel.findOne.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue({ isPublic: true }) });
            const result = await service.findCheekOwnerAndVisibilityBySlug('foo', 'slug');
            expect(result).toEqual({ owner: 'user1', isPublic: true });
        });
    });

    describe('createCheeks', () => {
        it('should create and save a new cheek', async () => {
            categoriesService.findOne.mockResolvedValue({});
            tagsService.findOrCreateTags.mockResolvedValue([]);
            const dto = { title: 'T', categoryId: '507f1f77bcf86cd799439011', tagNames: [], isPublic: true, links: [] };
            service.generateUniqueSlug = jest.fn().mockResolvedValue('slug');
            // Patch the constructor to return an instance whose save returns the expected result
            CheeksModelMock.mockImplementationOnce((data) => ({
                ...data,
                save: jest.fn().mockResolvedValue({
                    ...data,
                    slug: 'slug',
                    title: 'T',
                    populate: jest.fn().mockResolvedValue({ ...data, slug: 'slug', title: 'T' }),
                }),
                populate: jest.fn().mockResolvedValue({ ...data, slug: 'slug', title: 'T' }),
            }));
            const result = await service.createCheeks(dto, '507f1f77bcf86cd799439011');
            expect(result.title).toBe('T');
            expect(result.slug).toBe('slug');
        });
        it('should throw InternalServerErrorException on save error', async () => {
            categoriesService.findOne.mockResolvedValue({});
            tagsService.findOrCreateTags.mockResolvedValue([]);
            const dto = { title: 'T', categoryId: '507f1f77bcf86cd799439011', tagNames: [], isPublic: true, links: [] };
            service.generateUniqueSlug = jest.fn().mockResolvedValue('slug');
            // Patch the constructor to return an instance whose save rejects
            CheeksModelMock.mockImplementationOnce(() => ({ ...cheekDocMock(dto), save: jest.fn().mockRejectedValue({ code: 0, message: 'fail' }) }));
            await expect(service.createCheeks(dto, '507f1f77bcf86cd799439011')).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('getCheeksById', () => {
        it('should throw BadRequestException for invalid id', async () => {
            await expect(service.getCheeksById('bad')).rejects.toThrow(BadRequestException);
        });
        it('should return cheek with stats', async () => {
            CheeksModel.findById.mockReturnValue({ populate: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', title: 'C' }) });
            jest.spyOn(service as any, '_getReviewStatsForCheek').mockResolvedValue({ averageRating: 4, reviewCount: 2 });
            const result = await service.getCheeksById('507f1f77bcf86cd799439011');
            expect((result as any).averageRating).toBe(4);
            expect((result as any).reviewCount).toBe(2);
        });
    });

    describe('getCheekSuggestions', () => {
        it('should return empty array for short/empty search', async () => {
            const result = await service.getCheekSuggestions({ searchKeyword: 'a' });
            expect(result).toEqual([]);
        });
        it('should return suggestions for valid search', async () => {
            CheeksModel.find.mockReturnValue({ select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([{ title: 'T' }]) });
            const result = await service.getCheekSuggestions({ searchKeyword: 'foo', limit: 1 });
            expect(result[0].title).toBe('T');
        });
    });

    describe('getCheeksByUserId', () => {
        it('should throw NotFoundException for invalid user id', async () => {
            await expect(service.getCheeksByUserId('bad')).rejects.toThrow(NotFoundException);
        });
        it('should return cheeks for user', async () => {
            CheeksModel.find.mockReturnValue({ select: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([{ _id: 'c1' }]) });
            const result = await service.getCheeksByUserId('507f1f77bcf86cd799439011');
            expect(result[0]._id).toBe('c1');
        });
    });

    describe('updateCheeks', () => {
        it('should update a cheek and return the updated cheek', async () => {
            const id = '507f1f77bcf86cd799439011';
            const ownerId = '507f1f77bcf86cd799439011'; // Use valid ObjectId
            const updateDto = { title: 'Updated', description: 'desc' };
            const cheek = {
                _id: id,
                owner: ownerId,
                save: jest.fn().mockResolvedValue({ ...cheekDocMock({ _id: id, owner: ownerId, ...updateDto }), populate: jest.fn().mockResolvedValue({ ...cheekDocMock({ _id: id, owner: ownerId, ...updateDto }) }) }),
            };
            CheeksModel.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(cheek),
            });
            service.generateUniqueSlug = jest.fn().mockResolvedValue('slug'); // Patch slug generation
            const result = await service.updateCheeks(id, updateDto, ownerId);
            expect(CheeksModel.findById).toHaveBeenCalledWith(id);
            expect(result.title).toBe('Updated');
        });
        it('should throw ForbiddenException if not owner', async () => {
            const id = '507f1f77bcf86cd799439011';
            const updateDto = { title: 'Updated' };
            const cheek = { _id: id, owner: 'otherUser', save: jest.fn() };
            CheeksModel.findById.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(cheek),
            });
            await expect(service.updateCheeks(id, updateDto, '507f1f77bcf86cd799439011')).rejects.toThrow(ForbiddenException);
        });
    });

    describe('updateCheekVisibility', () => {
        it('should update visibility and return updated cheek', async () => {
            const id = '507f1f77bcf86cd799439011';
            const ownerId = '507f1f77bcf86cd799439011'; // Use valid ObjectId
            const updateDto = { isPublic: false };
            const cheek = {
                _id: id,
                owner: ownerId,
                save: jest.fn().mockResolvedValue({ ...cheekDocMock({ _id: id, owner: ownerId, isPublic: false }), populate: jest.fn().mockResolvedValue({ ...cheekDocMock({ _id: id, owner: ownerId, isPublic: false }) }) }),
            };
            CheeksModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(cheek) });
            const result = await service.updateCheekVisibility(id, updateDto, ownerId);
            expect(CheeksModel.findById).toHaveBeenCalledWith(id);
            expect(result.isPublic).toBe(false);
        });
        it('should throw ForbiddenException if not owner', async () => {
            const id = '507f1f77bcf86cd799439011';
            const updateDto = { isPublic: false };
            const cheek = { _id: id, owner: 'otherUser', save: jest.fn() };
            CheeksModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(cheek) });
            await expect(service.updateCheekVisibility(id, updateDto, '507f1f77bcf86cd799439011')).rejects.toThrow(ForbiddenException);
        });
    });

    describe('deleteCheeks', () => {
        it('should call _validateAndFetchOwnedCheek and not throw', async () => {
            const id = '507f1f77bcf86cd799439011';
            const ownerId = '507f1f77bcf86cd799439011'; // Use valid ObjectId
            (service as any)._validateAndFetchOwnedCheek = jest.fn().mockResolvedValue({
                _id: id,
                owner: ownerId,
            });
            // Mock reviewModel.deleteMany to prevent InternalServerErrorException
            reviewModel.deleteMany = jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
            });
            CheeksModel.findByIdAndDelete = jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue({ _id: id, owner: ownerId }),
            });
            // Do NOT mock CheeksModel.findById here
            await expect(service.deleteCheeks(id, ownerId)).resolves.toBeUndefined();
            expect((service as any)._validateAndFetchOwnedCheek).toHaveBeenCalledWith(id, ownerId);
        });
        it('should throw error if _validateAndFetchOwnedCheek throws', async () => {
            const id = '507f1f77bcf86cd799439011';
            const ownerId = '507f1f77bcf86cd799439011'; // Use valid ObjectId
            (service as any)._validateAndFetchOwnedCheek = jest.fn().mockRejectedValue(new NotFoundException());
            await expect(service.deleteCheeks(id, ownerId)).rejects.toThrow(NotFoundException);
        });
    });

    describe('getCheeksPaginated', () => {
        beforeEach(() => {
            CheeksModel.find.mockReset();
            CheeksModel.countDocuments.mockReset();
        });
        it('should call find and countDocuments with correct query and sort (default)', async () => {
            CheeksModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([{ _id: 'c1', title: 'A' }]),
            });
            CheeksModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
            const result = await service.getCheeksPaginated({});
            expect(result.cheeks[0]._id).toBe('c1');
            expect(result.totalItems).toBe(1);
            expect(CheeksModel.find).toHaveBeenCalled();
            expect(CheeksModel.countDocuments).toHaveBeenCalled();
        });
        it('should support sortBy: oldest', async () => {
            const sortSpy = jest.fn().mockReturnThis();
            CheeksModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: sortSpy,
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([{ _id: 'c2', title: 'B' }]),
            });
            CheeksModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
            await service.getCheeksPaginated({ sortBy: 'oldest' });
            expect(sortSpy).toHaveBeenCalledWith({ createdAt: 1 });
        });
        it('should support sortBy: rating', async () => {
            const sortSpy = jest.fn().mockReturnThis();
            CheeksModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: sortSpy,
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([{ _id: 'c3', title: 'C' }]),
            });
            CheeksModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
            await service.getCheeksPaginated({ sortBy: 'rating' });
            expect(sortSpy).toHaveBeenCalledWith({ averageRating: -1, createdAt: -1 });
        });
        it('should support sortBy: reviewCount', async () => {
            const sortSpy = jest.fn().mockReturnThis();
            CheeksModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: sortSpy,
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([{ _id: 'c4', title: 'D' }]),
            });
            CheeksModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
            await service.getCheeksPaginated({ sortBy: 'reviewCount' });
            expect(sortSpy).toHaveBeenCalledWith({ reviewCount: -1, createdAt: -1 });
        });
        it('should support sortBy: alpha', async () => {
            const sortSpy = jest.fn().mockReturnThis();
            CheeksModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: sortSpy,
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([{ _id: 'c5', title: 'E' }]),
            });
            CheeksModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
            await service.getCheeksPaginated({ sortBy: 'alpha' });
            expect(sortSpy).toHaveBeenCalledWith({ title: 1, createdAt: -1 });
        });
        it('should support sortBy: alphaDesc', async () => {
            const sortSpy = jest.fn().mockReturnThis();
            CheeksModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: sortSpy,
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([{ _id: 'c6', title: 'F' }]),
            });
            CheeksModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
            await service.getCheeksPaginated({ sortBy: 'alphaDesc' });
            expect(sortSpy).toHaveBeenCalledWith({ title: -1, createdAt: -1 });
        });
        it('should support pagination', async () => {
            const skipSpy = jest.fn().mockReturnThis();
            const limitSpy = jest.fn().mockReturnThis();
            CheeksModel.find.mockReturnValue({
                select: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                sort: jest.fn().mockReturnThis(),
                skip: skipSpy,
                limit: limitSpy,
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([{ _id: 'c7', title: 'G' }]),
            });
            CheeksModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
            await service.getCheeksPaginated({ page: 2, limit: 5 });
            expect(skipSpy).toHaveBeenCalledWith(5); // (page-1)*limit
            expect(limitSpy).toHaveBeenCalledWith(5);
        });
        it('should support filtering by categoryIds and tagIds', async () => {
            const findSpy = jest.fn().mockReturnThis();
            CheeksModel.find.mockImplementation((query) => {
                findSpy(query);
                return {
                    select: jest.fn().mockReturnThis(),
                    populate: jest.fn().mockReturnThis(),
                    sort: jest.fn().mockReturnThis(),
                    skip: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockReturnThis(),
                    lean: jest.fn().mockReturnThis(),
                    exec: jest.fn().mockResolvedValue([{ _id: 'c8', title: 'H' }]),
                };
            });
            CheeksModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
            const categoryId = '507f1f77bcf86cd799439011';
            const tagId = '507f1f77bcf86cd799439012';
            await service.getCheeksPaginated({ categoryIds: [categoryId], tagIds: [tagId] });
            expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
                categoryId: { $in: [expect.any(Object)] },
                tagIds: { $in: [expect.any(Object)] },
            }));
        });
    });
});
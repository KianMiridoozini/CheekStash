import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReviewsService } from './reviews.service';
import { NotFoundException, ForbiddenException, ConflictException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Review } from './schemas/review.schema';
import { CheeksService } from '../cheeks/cheeks.service';
import { UsersService } from '../users/users.service';

const mockReviewModel = jest.fn();
Object.assign(mockReviewModel, {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
    create: jest.fn(),
});

const mockCheeksService = {
    getCheeksById: jest.fn(),
    findCheekOwnerAndVisibility: jest.fn(),
    findCheekByUsernameAndSlug: jest.fn(),
    recalculateAndUpdateCheekStats: jest.fn(),
};
const mockUsersService = {};

const mockReview = (overrides = {}) => ({
    _id: new Types.ObjectId(),
    cheekId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    username: 'user',
    rating: 5,
    review: 'Great!',
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue({ ...overrides }),
    ...overrides,
});

describe('ReviewsService', () => {
    let service: ReviewsService;
    let model: any;
    let cheeksService: any;
    beforeAll(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReviewsService,
                { provide: getModelToken(Review.name), useValue: mockReviewModel },
                { provide: CheeksService, useValue: mockCheeksService },
                { provide: UsersService, useValue: mockUsersService },
            ],
        }).compile();
        service = module.get<ReviewsService>(ReviewsService);
        model = module.get(getModelToken(Review.name));
        cheeksService = module.get(CheeksService);
        jest.clearAllMocks();
    });

    describe('createReview', () => {
        const validCheekId = '507f1f77bcf86cd799439011';
        const validReviewId = '507f1f77bcf86cd799439012';
        const validUserId = '507f1f77bcf86cd799439013';
        it('should create and return a review', async () => {
            cheeksService.getCheeksById.mockResolvedValue({ _id: validCheekId, owner: 'otherUser' });
            cheeksService.recalculateAndUpdateCheekStats.mockResolvedValue(undefined); // <-- mock stat update
            model.findOne.mockResolvedValue(null);
            model.mockImplementationOnce(() => ({
                save: jest.fn().mockResolvedValue({ _id: validReviewId }),
            }));
            model.findById.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({
                    _id: validReviewId,
                    cheekId: validCheekId,
                    userId: { _id: validUserId, username: 'user' },
                    rating: 5,
                    review: 'Great!',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
            });
            const dto = { cheekId: validCheekId, rating: 5, review: 'Great!' };
            const result = await service.createReview(dto as any, validUserId, 'user');
            expect(result.rating).toBe(5);
            expect(result.review).toBe('Great!');
            expect(cheeksService.recalculateAndUpdateCheekStats).toHaveBeenCalledWith(validCheekId);
        });
        it('should throw ForbiddenException if reviewing own cheek', async () => {
            cheeksService.getCheeksById.mockResolvedValue({ _id: validCheekId, owner: validUserId });
            const dto = { cheekId: validCheekId, rating: 5, review: 'Great!' };
            await expect(service.createReview(dto as any, validUserId, 'user')).rejects.toThrow(ForbiddenException);
        });
        it('should throw ConflictException if already reviewed', async () => {
            cheeksService.getCheeksById.mockResolvedValue({ _id: validCheekId, owner: 'otherUser' });
            model.findOne.mockResolvedValue({ _id: validReviewId });
            const dto = { cheekId: validCheekId, rating: 5, review: 'Great!' };
            await expect(service.createReview(dto as any, validUserId, 'user')).rejects.toThrow(ConflictException);
        });
    });

    describe('getReviewsForCheek', () => {
        const validCheekId = '507f1f77bcf86cd799439011';
        it('should return reviews and stats', async () => {
            cheeksService.findCheekOwnerAndVisibility.mockResolvedValue({ owner: 'user1', isPublic: true });
            const reviews = [mockReview({ rating: 5 }), mockReview({ rating: 4 })];
            model.find.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(reviews),
            });
            const result = await service.getReviewsForCheek(validCheekId);
            expect(result.reviews.length).toBe(2);
            expect(result.averageRating).toBe(4.5);
        });
        it('should throw BadRequestException for invalid cheekId', async () => {
            await expect(service.getReviewsForCheek('bad')).rejects.toThrow(BadRequestException);
        });
        it('should throw ForbiddenException for private cheek', async () => {
            cheeksService.findCheekOwnerAndVisibility.mockResolvedValue({ owner: 'user1', isPublic: false });
            await expect(service.getReviewsForCheek(validCheekId, 1, 10, 'createdAt', 'desc', undefined, 'otherUser')).rejects.toThrow(ForbiddenException);
        });
    });

    describe('getReviewById', () => {
        const validReviewId = '507f1f77bcf86cd799439012';
        it('should return a review by id', async () => {
            model.findById.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({
                    _id: validReviewId,
                    cheekId: { _id: '507f1f77bcf86cd799439011', isPublic: true, owner: 'user1' },
                    userId: { _id: 'user1', username: 'user' },
                    rating: 5,
                    review: 'Great!',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
            });
            const result = await service.getReviewById(validReviewId, 'user1');
            expect(result.rating).toBe(5);
        });
        it('should throw BadRequestException for invalid id', async () => {
            await expect(service.getReviewById('bad')).rejects.toThrow(BadRequestException);
        });
        it('should throw NotFoundException if not found', async () => {
            model.findById.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue(null),
            });
            await expect(service.getReviewById(validReviewId)).rejects.toThrow(NotFoundException);
        });
        it('should throw ForbiddenException for private cheek', async () => {
            model.findById.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({
                    _id: validReviewId,
                    cheekId: { _id: '507f1f77bcf86cd799439011', isPublic: false, owner: 'user1' },
                    userId: { _id: 'user2', username: 'user2' },
                    rating: 5,
                    review: 'Great!',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
            });
            await expect(service.getReviewById(validReviewId, 'otherUser')).rejects.toThrow(ForbiddenException);
        });
    });

    describe('updateReview', () => {
        const validReviewId = '507f1f77bcf86cd799439012';
        const validUserId = '507f1f77bcf86cd799439013';
        it('should update and return the review', async () => {
            const review = mockReview({ _id: validReviewId, userId: validUserId });
            cheeksService.recalculateAndUpdateCheekStats.mockResolvedValue(undefined);
            model.findOne.mockResolvedValue(review);
            review.save = jest.fn().mockResolvedValue({ ...review, review: 'Updated' });
            model.findById.mockReturnValue({
                populate: jest.fn().mockReturnThis(),
                lean: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue({ ...review, review: 'Updated', userId: { _id: validUserId, username: 'user' } }),
            });
            const result = await service.updateReview(validReviewId, { review: 'Updated' }, validUserId);
            expect(result.review).toBe('Updated');
            expect(cheeksService.recalculateAndUpdateCheekStats).toHaveBeenCalledWith(review.cheekId);
        });
        it('should throw NotFoundException if not found', async () => {
            model.findOne.mockResolvedValue(null);
            await expect(service.updateReview(validReviewId, { review: 'Updated' }, validUserId)).rejects.toThrow(NotFoundException);
        });
    });

    describe('deleteReview', () => {
        const validReviewId = '507f1f77bcf86cd799439012';
        const validUserId = '507f1f77bcf86cd799439013';
        it('should delete and return message', async () => {
            // Add a mock for cheeksService.recalculateAndUpdateCheekStats
            cheeksService.recalculateAndUpdateCheekStats.mockResolvedValue(undefined);
            // Mock reviewToDelete
            model.findOne.mockResolvedValue({ _id: validReviewId, userId: validUserId, cheekId: 'cheekId' });
            model.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) });
            const result = await service.deleteReview(validReviewId, validUserId);
            expect(result).toEqual({ message: 'Review deleted successfully' });
            expect(cheeksService.recalculateAndUpdateCheekStats).toHaveBeenCalledWith('cheekId');
        });
        it('should throw NotFoundException if not found', async () => {
            model.deleteOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 0 }) });
            await expect(service.deleteReview(validReviewId, validUserId)).rejects.toThrow(NotFoundException);
        });
    });
});

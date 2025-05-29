import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CheekVisibilityGuard } from '../common/guards/cheek-visibility.guard';
import { CheeksService } from '../cheeks/cheeks.service';

const mockUser = { id: '60c72b2f9b1e8e5a6c8f9e1a', username: 'testuser' };
const mockReviewId = '60c72b2f9b1e8e5a6c8f9e1b';
const mockCheekId = '60c72b2f9b1e8e5a6c8f9e1c';
const mockReview = {
    _id: mockReviewId,
    cheek: mockCheekId,
    owner: { id: mockUser.id, username: mockUser.username },
    text: 'Great cheek!',
    rating: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
};
const mockTransformedReview = {
    _id: mockReviewId,
    cheekId: mockCheekId,
    user: { _id: mockUser.id, username: mockUser.username },
    review: 'Great cheek!',
    rating: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

const mockReviewsArray = [mockTransformedReview];

const mockReviewsService = {
    createReview: jest.fn(),
    getReviewsForCheek: jest.fn(),
    getReviewsForCheekBySlug: jest.fn(),
    getReviewById: jest.fn(),
    updateReview: jest.fn(),
    deleteReview: jest.fn(),
};
const mockCheekVisibilityGuard = { canActivate: jest.fn().mockReturnValue(true) };
const mockCheeksService = {};

describe('ReviewsController', () => {
    let controller: ReviewsController;
    let service: typeof mockReviewsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReviewsController],
            providers: [
                { provide: ReviewsService, useValue: mockReviewsService },
                { provide: CheekVisibilityGuard, useValue: mockCheekVisibilityGuard },
                { provide: CheeksService, useValue: mockCheeksService },
            ],
        }).compile();

        controller = module.get<ReviewsController>(ReviewsController);
        service = module.get(ReviewsService);
        jest.clearAllMocks();
    });

    describe('createReview', () => {
        it('should call service and return created review', async () => {
            const dto: CreateReviewDto = { cheekId: mockCheekId, review: 'Great cheek!', rating: 5 };
            (service.createReview as jest.Mock).mockResolvedValue(mockTransformedReview);
            const req = { user: mockUser };
            const result = await controller.createReview(dto, req);
            expect(service.createReview).toHaveBeenCalledWith(dto, mockUser.id, mockUser.username);
            expect(result).toEqual(mockTransformedReview);
        });
    });

    describe('getReviews', () => {
        it('should call service and return reviews for cheek', async () => {
            (service.getReviewsForCheek as jest.Mock).mockResolvedValue(mockReviewsArray);
            const req = { user: mockUser };
            const result = await controller.getReviews(mockCheekId, req);
            expect(service.getReviewsForCheek).toHaveBeenCalledWith(
                mockCheekId, 1, 10, 'createdAt', 'desc', undefined, mockUser.id
            );
            expect(result).toEqual(mockReviewsArray);
        });
        it('should call service with undefined user if not logged in', async () => {
            (service.getReviewsForCheek as jest.Mock).mockResolvedValue(mockReviewsArray);
            const req = {};
            const result = await controller.getReviews(mockCheekId, req);
            expect(service.getReviewsForCheek).toHaveBeenCalledWith(
                mockCheekId, 1, 10, 'createdAt', 'desc', undefined, undefined
            );
            expect(result).toEqual(mockReviewsArray);
        });
    });

    describe('getReviewsBySlug', () => {
        it('should call service and return reviews for cheek by slug', async () => {
            (service.getReviewsForCheekBySlug as jest.Mock).mockResolvedValue(mockReviewsArray);
            const req = { user: mockUser };
            const result = await controller.getReviewsBySlug('testuser', 'cheek-slug', req);
            expect(service.getReviewsForCheekBySlug).toHaveBeenCalledWith(
                'testuser', 'cheek-slug', 1, 10, 'createdAt', 'desc', undefined, mockUser.id
            );
            expect(result).toEqual(mockReviewsArray);
        });
        it('should call service with undefined user if not logged in', async () => {
            (service.getReviewsForCheekBySlug as jest.Mock).mockResolvedValue(mockReviewsArray);
            const req = {};
            const result = await controller.getReviewsBySlug('testuser', 'cheek-slug', req);
            expect(service.getReviewsForCheekBySlug).toHaveBeenCalledWith(
                'testuser', 'cheek-slug', 1, 10, 'createdAt', 'desc', undefined, undefined
            );
            expect(result).toEqual(mockReviewsArray);
        });
    });

    describe('getReviewById', () => {
        it('should call service and return review by id', async () => {
            (service.getReviewById as jest.Mock).mockResolvedValue(mockTransformedReview);
            const req = { user: mockUser };
            const result = await controller.getReviewById(mockReviewId, req);
            expect(service.getReviewById).toHaveBeenCalledWith(mockReviewId, mockUser.id);
            expect(result).toEqual(mockTransformedReview);
        });
        it('should call service with undefined user if not logged in', async () => {
            (service.getReviewById as jest.Mock).mockResolvedValue(mockTransformedReview);
            const req = {};
            const result = await controller.getReviewById(mockReviewId, req);
            expect(service.getReviewById).toHaveBeenCalledWith(mockReviewId, undefined);
            expect(result).toEqual(mockTransformedReview);
        });
    });

    describe('updateReview', () => {
        it('should call service and return updated review', async () => {
            const dto: UpdateReviewDto = { review: 'Updated review', rating: 4 };
            const updatedReview = { ...mockTransformedReview, review: 'Updated review', rating: 4 };
            (service.updateReview as jest.Mock).mockResolvedValue(updatedReview);
            const req = { user: mockUser };
            const result = await controller.updateReview(mockReviewId, dto, req);
            expect(service.updateReview).toHaveBeenCalledWith(mockReviewId, dto, mockUser.id);
            expect(result).toEqual(updatedReview);
        });
    });

    describe('deleteReview', () => {
        it('should call service and return delete message', async () => {
            (service.deleteReview as jest.Mock).mockResolvedValue({ message: 'Review deleted successfully' });
            const req = { user: mockUser };
            const result = await controller.deleteReview(mockReviewId, req);
            expect(service.deleteReview).toHaveBeenCalledWith(mockReviewId, mockUser.id);
            expect(result).toEqual({ message: 'Review deleted successfully' });
        });
    });
});

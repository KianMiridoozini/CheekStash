// src/reviews/reviews.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

// Mock ReviewsService
const mockReviewsService = {
  createReview: jest.fn(),
  getReviewsForCheeks: jest.fn(),
  updateReview: jest.fn(),
  deleteReview: jest.fn(),
};

// Mock Request object
const mockRequest = (userPayload: any) => ({
  user: userPayload,
});

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: ReviewsService;

  beforeEach(async () => {
    jest.clearAllMocks(); // Clear first

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService, // Provide the mock service
        },
      ],
    })
    .overrideGuard(JwtAuthGuard) // Mock the guard
    .useValue({ canActivate: jest.fn(() => true) }) // Allow access
    .compile();

    controller = module.get<ReviewsController>(ReviewsController);
    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined(); // Should pass now
  });

  // --- Test createReview ---
  describe('createReview', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const createDto: CreateReviewDto = { cheekId: cheekId, rating: 5, review: 'Nice!' };
    const userPayload = { id: new Types.ObjectId().toHexString(), username: 'testuser' };
    const req = mockRequest(userPayload);
    const createdReview = { ...createDto, _id: new Types.ObjectId(), userId: userPayload.id, username: userPayload.username };

    it('should call service.createReview with dto, user id, and username', async () => {
        // Arrange
        mockReviewsService.createReview.mockResolvedValueOnce(createdReview);

        // Act
        const result = await controller.createReview(createDto, req);

        // Assert
        expect(service.createReview).toHaveBeenCalledWith(createDto, userPayload.id, userPayload.username);
        expect(result).toEqual(createdReview);
    });
  });

  // --- Test getReviews ---
  describe('getReviews', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const expectedReviews = [{ review: 'Review 1' }, { review: 'Review 2' }];

    it('should call service.getReviewsForCheeks with cheekId', async () => {
        // Arrange
        mockReviewsService.getReviewsForCheeks.mockResolvedValueOnce(expectedReviews);

        // Act
        const result = await controller.getReviews(cheekId);

        // Assert
        expect(service.getReviewsForCheeks).toHaveBeenCalledWith(cheekId);
        expect(result).toEqual(expectedReviews);
    });
  });

  // --- Test updateReview ---
  describe('updateReview', () => {
    const reviewId = new Types.ObjectId().toHexString();
    const updateDto: UpdateReviewDto = { review: 'Updated Review' };
    const userPayload = { id: new Types.ObjectId().toHexString(), username: 'updater' };
    const req = mockRequest(userPayload);
    const updatedReview = { _id: reviewId, review: 'Updated Review', userId: userPayload.id };

    it('should call service.updateReview with reviewId, dto, and user id', async () => {
        // Arrange
        mockReviewsService.updateReview.mockResolvedValueOnce(updatedReview);

        // Act
        const result = await controller.updateReview(reviewId, updateDto, req);

        // Assert
        expect(service.updateReview).toHaveBeenCalledWith(reviewId, updateDto, userPayload.id);
        expect(result).toEqual(updatedReview);
    });
  });

  // --- Test deleteReview ---
  describe('deleteReview', () => {
    const reviewId = new Types.ObjectId().toHexString();
    const userPayload = { id: new Types.ObjectId().toHexString(), username: 'deleter' };
    const req = mockRequest(userPayload);
    const deleteResult = { message: 'Review deleted successfully' };

    it('should call service.deleteReview with reviewId and user id', async () => {
        // Arrange
        mockReviewsService.deleteReview.mockResolvedValueOnce(deleteResult);

        // Act
        const result = await controller.deleteReview(reviewId, req);

        // Assert
        expect(service.deleteReview).toHaveBeenCalledWith(reviewId, userPayload.id);
        expect(result).toEqual(deleteResult);
    });
  });
});
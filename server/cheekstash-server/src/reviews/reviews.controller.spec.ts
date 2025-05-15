// src/reviews/reviews.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';

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

    it('should propagate errors from the service when creation fails', async () => {
      const error = new InternalServerErrorException('Creation failed');
      mockReviewsService.createReview.mockRejectedValueOnce(error);

      await expect(controller.createReview(createDto, req)).rejects.toThrow(InternalServerErrorException);
      expect(service.createReview).toHaveBeenCalledWith(createDto, userPayload.id, userPayload.username);
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

    it('should propagate errors from the service when fetching reviews fails', async () => {
      const error = new InternalServerErrorException('Failed to fetch reviews');
      mockReviewsService.getReviewsForCheeks.mockRejectedValueOnce(error);

      await expect(controller.getReviews(cheekId)).rejects.toThrow(InternalServerErrorException);
      expect(service.getReviewsForCheeks).toHaveBeenCalledWith(cheekId);
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

    it('should propagate NotFoundException from the service if review is not found for update', async () => {
      const error = new NotFoundException('Review not found');
      mockReviewsService.updateReview.mockRejectedValueOnce(error);

      await expect(controller.updateReview(reviewId, updateDto, req)).rejects.toThrow(NotFoundException);
      expect(service.updateReview).toHaveBeenCalledWith(reviewId, updateDto, userPayload.id);
    });

    it('should propagate ForbiddenException from the service if user is not allowed to update', async () => {
      const error = new ForbiddenException('Cannot update review');
      mockReviewsService.updateReview.mockRejectedValueOnce(error);

      await expect(controller.updateReview(reviewId, updateDto, req)).rejects.toThrow(ForbiddenException);
      expect(service.updateReview).toHaveBeenCalledWith(reviewId, updateDto, userPayload.id);
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

    it('should propagate NotFoundException from the service if review is not found for deletion', async () => {
      const error = new NotFoundException('Review not found');
      mockReviewsService.deleteReview.mockRejectedValueOnce(error);

      await expect(controller.deleteReview(reviewId, req)).rejects.toThrow(NotFoundException);
      expect(service.deleteReview).toHaveBeenCalledWith(reviewId, userPayload.id);
    });

    it('should propagate ForbiddenException from the service if user is not allowed to delete', async () => {
      const error = new ForbiddenException('Cannot delete review');
      mockReviewsService.deleteReview.mockRejectedValueOnce(error);

      await expect(controller.deleteReview(reviewId, req)).rejects.toThrow(ForbiddenException);
      expect(service.deleteReview).toHaveBeenCalledWith(reviewId, userPayload.id);
    });
  });
});
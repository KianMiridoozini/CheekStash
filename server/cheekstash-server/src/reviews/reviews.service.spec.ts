// src/reviews/reviews.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ReviewsService } from './reviews.service';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';

// --- Mocking Setup ---
const mockStaticMethods = {
  find: jest.fn(),
  findById: jest.fn(),
  // Add others if ReviewService uses them
};

const mockDocument = (dto: any = {}, userId?: string, username?: string, cheekId?: string) => {
  const doc = {
    ...dto,
    _id: dto._id || new Types.ObjectId(),
    userId: new Types.ObjectId(userId || new Types.ObjectId().toHexString()),
    username: username || 'testuser',
    cheekId: new Types.ObjectId(cheekId || new Types.ObjectId().toHexString()),
    rating: dto.rating || 5,
    review: dto.review || 'review',
    save: jest.fn().mockResolvedValue({
      ...dto,
      _id: dto._id || new Types.ObjectId(),
      userId: new Types.ObjectId(userId || new Types.ObjectId().toHexString()),
      username: username || 'testuser',
      cheekId: new Types.ObjectId(cheekId || new Types.ObjectId().toHexString()),
    }),
    deleteOne: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
    toString: jest.fn().mockReturnValue(JSON.stringify({ ...dto, _id: dto._id, userId, username, cheekId })),
  };
  return doc;
};


const mockQuery = (resolveValue: any = null) => ({
  exec: jest.fn().mockResolvedValue(resolveValue),
  select: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
});

const createMockReviewModel = () => {
  const model = jest.fn().mockImplementation((dto) => mockDocument(dto)); // Mock constructor
  Object.assign(model, mockStaticMethods); // Assign static methods
  return model;
};
// --- End Mocking Setup ---


describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewModel: jest.Mock & typeof mockStaticMethods;

  beforeEach(async () => {
    jest.clearAllMocks(); // Clear first

    reviewModel = createMockReviewModel() as jest.Mock & typeof mockStaticMethods;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getModelToken(Review.name),
          useValue: reviewModel, // Use the mock model
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test createReview ---
  describe('createReview', () => {
    const userId = new Types.ObjectId().toHexString();
    const username = 'reviewer';
    const cheekId = new Types.ObjectId().toHexString();
    // --- FIX: Match CreateReviewDto (uses 'review') ---
    const createDto: CreateReviewDto = { cheekId: cheekId, rating: 5, review: 'Great!' };
    // Use the actual schema properties in the mock document data
    const savedReviewDoc = mockDocument(
        { rating: createDto.rating, review: createDto.review }, // Use schema props
        userId,
        username,
        cheekId
    );
    it('should create and save a new review', async () => {
      // Arrange
      const mockSave = jest.fn().mockResolvedValue(savedReviewDoc);
      // Ensure the constructor mock aligns with what the service passes
      reviewModel.mockImplementationOnce(() => ({
          cheekId: createDto.cheekId, // Passed from DTO
          rating: createDto.rating, // Passed from DTO
          review: createDto.review, // Passed from DTO
          userId, // Passed from args
          username, // Passed from args
          save: mockSave,
      }));

      // Act
      const result = await service.createReview(createDto, userId, username);

      // Assert
      expect(reviewModel).toHaveBeenCalledWith({ // Check constructor call args
          cheekId: createDto.cheekId,
          rating: createDto.rating,
          review: createDto.review,
          userId,
          username,
       });
      expect(mockSave).toHaveBeenCalled();

      // --- FIX: Use toMatchObject for partial comparison without mock functions ---
      expect(result).toMatchObject({
          // Convert expected IDs to ObjectId for comparison if mock returns ObjectId
          cheekId: new Types.ObjectId(cheekId),
          userId: new Types.ObjectId(userId),
          username: username,
          rating: createDto.rating,
          review: createDto.review, // Check the 'review' property from schema
          // Do not include _id unless you specifically mock and want to check it
          // Do not include mock functions like save, deleteOne
      });
    });

    it('should throw InternalServerErrorException if save fails', async () => {
        // Arrange
        const errorMessage = 'Database error';
        const error = new Error(errorMessage);
        const mockSave = jest.fn().mockRejectedValue(error);
        reviewModel.mockImplementationOnce(() => ({
            cheekId: createDto.cheekId,
            rating: createDto.rating,
            review: createDto.review,
            userId,
            username,
            save: mockSave,
        }));

        // Act & Assert
        await expect(service.createReview(createDto, userId, username))
            .rejects
            .toThrow(new InternalServerErrorException(`Failed to create review: ${errorMessage}`));
    });
  });

  // --- Test getReviewsForCheeks ---
  describe('getReviewsForCheeks', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const reviewsData = [
        mockDocument({ review: 'Review 1' }, undefined, undefined, cheekId),
        mockDocument({ review: 'Review 2' }, undefined, undefined, cheekId),
    ];

    it('should return reviews for a specific cheekId', async () => {
        // Arrange
        const mockFindQuery = mockQuery(reviewsData);
        reviewModel.find.mockReturnValueOnce(mockFindQuery as any);

        // Act
        const result = await service.getReviewsForCheeks(cheekId);

        // Assert
        expect(reviewModel.find).toHaveBeenCalledWith({ cheekId });
        expect(mockFindQuery.exec).toHaveBeenCalled();
        expect(result).toEqual(reviewsData);
    });
  });

  // --- Test updateReview ---
  describe('updateReview', () => {
    const reviewId = new Types.ObjectId().toHexString();
    const ownerId = new Types.ObjectId().toHexString();
    const nonOwnerId = new Types.ObjectId().toHexString();
    // --- FIX: Match UpdateReviewDto (uses 'review') ---
    const updateDto: UpdateReviewDto = { rating: 4, review: 'Updated review' };
    const originalReviewDoc = mockDocument({ rating: 5, review: 'Old' }, ownerId);
    // Ensure updated data also uses 'review'
    const updatedReviewDocData = { ...originalReviewDoc, rating: updateDto.rating, review: updateDto.review };


     const mockUpdatedSave = jest.fn().mockResolvedValue(updatedReviewDocData);
     // Ensure the instance being updated has the save mock
     const mockOriginalInstanceWithUpdateSave = {
        ...originalReviewDoc,
        save: mockUpdatedSave,
        // Mock the Object.assign behavior by pre-applying changes if needed,
        // Mongoose handles this internally, but mock needs to simulate the final state
        rating: updateDto.rating,
        review: updateDto.review,
     };

     it('should update the review if user is the owner', async () => {
      // Arrange
      reviewModel.findById.mockResolvedValueOnce(mockOriginalInstanceWithUpdateSave);

      // Act
      const result = await service.updateReview(reviewId, updateDto, ownerId);

      // Assert
      expect(reviewModel.findById).toHaveBeenCalledWith(reviewId);
      expect(mockUpdatedSave).toHaveBeenCalled(); // Save is called on the instance
      // --- FIX: Use toMatchObject for comparison ---
      expect(result).toMatchObject({
           rating: updateDto.rating,
           review: updateDto.review,
           // Check other important fields if needed
           _id: originalReviewDoc._id,
           userId: originalReviewDoc.userId
      });
  });

    it('should throw NotFoundException if review not found', async () => {
        // Arrange
        reviewModel.findById.mockResolvedValueOnce(null);

        // Act & Assert
        await expect(service.updateReview(reviewId, updateDto, ownerId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
        // Arrange
        reviewModel.findById.mockResolvedValueOnce(originalReviewDoc); // Found, but owner ID mismatch

        // Act & Assert
        await expect(service.updateReview(reviewId, updateDto, nonOwnerId)).rejects.toThrow(ForbiddenException);
         expect(originalReviewDoc.save).not.toHaveBeenCalled(); // Ensure save wasn't called
    });
  });

  // --- Test deleteReview ---
  describe('deleteReview', () => {
    const reviewId = new Types.ObjectId().toHexString();
    const ownerId = new Types.ObjectId().toHexString();
    const nonOwnerId = new Types.ObjectId().toHexString();
    const reviewDoc = mockDocument({}, ownerId); 

    it('should delete the review if user is the owner', async () => {
        // Arrange
        reviewModel.findById.mockResolvedValueOnce(reviewDoc);

        // Act
        const result = await service.deleteReview(reviewId, ownerId);

        // Assert
        expect(reviewModel.findById).toHaveBeenCalledWith(reviewId);
        expect(reviewDoc.deleteOne).toHaveBeenCalled();
        expect(result).toEqual({ message: 'Review deleted successfully' });
    });

    it('should throw NotFoundException if review not found', async () => {
        // Arrange
        reviewModel.findById.mockResolvedValueOnce(null);

        // Act & Assert
        await expect(service.deleteReview(reviewId, ownerId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
        // Arrange
        reviewModel.findById.mockResolvedValueOnce(reviewDoc);

        // Act & Assert
        await expect(service.deleteReview(reviewId, nonOwnerId)).rejects.toThrow(ForbiddenException);
        expect(reviewDoc.deleteOne).not.toHaveBeenCalled(); // Ensure delete wasn't called
    });
  });
});
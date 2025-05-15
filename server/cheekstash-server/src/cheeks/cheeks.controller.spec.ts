// src/cheeks/cheeks.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CheeksController } from './cheeks.controller';
import { CheeksService } from './cheeks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheeksDto } from './dto/cheeks.dto';
import { UpdateCheeksDto } from './dto/update-cheeks.dto';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';

// Mock CheeksService
const mockCheeksService = {
  createCheeks: jest.fn(),
  getCheeks: jest.fn(),
  getCheeksById: jest.fn(),
  updateCheeks: jest.fn(),
  deleteCheeks: jest.fn(),
};

// Mock Request object
const mockRequest = (userPayload: any) => ({
  user: userPayload,
});

describe('CheeksController', () => {
  let controller: CheeksController;
  let service: CheeksService;

  beforeEach(async () => {
    jest.clearAllMocks(); // Clear first

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CheeksController],
      providers: [
        {
          provide: CheeksService,
          useValue: mockCheeksService, // Provide the mock service
        },
      ],
    })
    .overrideGuard(JwtAuthGuard) // Mock the guard for all tests in this suite
    .useValue({ canActivate: jest.fn(() => true) }) // Allow access
    .compile();

    controller = module.get<CheeksController>(CheeksController);
    service = module.get<CheeksService>(CheeksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined(); // This should pass now
  });

  // --- Test create ---
  describe('create', () => {
    const categoryId = new Types.ObjectId().toHexString();
    const cheeksDto: CheeksDto = {
      title: 'New Cheek',
      description: 'd',
      categoryId: categoryId,
      links: [
        { title: 't', url: 'u', description: 'd', order: 0 },
        { title: 't2', url: 'u2', description: 'd2', order: 1 },
      ],
      tagNames: ['test-tag', 'another-tag'], // Changed from tagIds to tagNames
      isPublic: false,
    };
    const userPayload = { id: new Types.ObjectId().toHexString(), username: 'testuser' };
    const req = mockRequest(userPayload);
    const createdCheek = { ...cheeksDto, _id: new Types.ObjectId(), owner: userPayload.id };

    it('should call service.createCheeks with dto and user id', async () => {
      // Arrange
      mockCheeksService.createCheeks.mockResolvedValueOnce(createdCheek);

      // Act
      const result = await controller.create(cheeksDto, req);

      // Assert
      expect(service.createCheeks).toHaveBeenCalledWith(cheeksDto, userPayload.id);
      expect(result).toEqual(createdCheek);
    });

    it('should propagate errors from the service when creation fails', async () => {
      const error = new InternalServerErrorException('Creation failed');
      mockCheeksService.createCheeks.mockRejectedValueOnce(error);

      await expect(controller.create(cheeksDto, req)).rejects.toThrow(InternalServerErrorException);
      expect(service.createCheeks).toHaveBeenCalledWith(cheeksDto, userPayload.id);
    });
  });

  // --- Test findAll ---
  describe('findAll', () => {
    it('should call service.getCheeks', async () => {
      // Arrange
      const expectedCheeks = [{ name: 'Cheek 1' }, { name: 'Cheek 2' }];
      mockCheeksService.getCheeks.mockResolvedValueOnce(expectedCheeks);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(service.getCheeks).toHaveBeenCalled();
      expect(result).toEqual(expectedCheeks);
    });

    it('should propagate errors from the service when finding all fails', async () => {
      const error = new InternalServerErrorException('Failed to get cheeks');
      mockCheeksService.getCheeks.mockRejectedValueOnce(error);

      await expect(controller.findAll()).rejects.toThrow(InternalServerErrorException);
      expect(service.getCheeks).toHaveBeenCalled();
    });
  });

  // --- Test findOne ---
  describe('findOne', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const expectedCheek = { _id: cheekId, name: 'Found Cheek' };

    it('should call service.getCheeksById with the id param', async () => {
      // Arrange
      mockCheeksService.getCheeksById.mockResolvedValueOnce(expectedCheek);

      // Act
      const result = await controller.findOne(cheekId);

      // Assert
      expect(service.getCheeksById).toHaveBeenCalledWith(cheekId);
      expect(result).toEqual(expectedCheek);
    });

    it('should propagate NotFoundException from the service if cheek is not found', async () => {
      const error = new NotFoundException('Cheek not found');
      mockCheeksService.getCheeksById.mockRejectedValueOnce(error);

      await expect(controller.findOne(cheekId)).rejects.toThrow(NotFoundException);
      expect(service.getCheeksById).toHaveBeenCalledWith(cheekId);
    });
  });

  // --- Test update ---
  describe('update', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const updateDto: UpdateCheeksDto = { description: 'Updated' };
    const userPayload = { id: new Types.ObjectId().toHexString(), username: 'updater' };
    const req = mockRequest(userPayload);
    const updatedCheek = { _id: cheekId, name: 'Cheek', description: 'Updated', owner: userPayload.id };

    it('should call service.updateCheeks with id, dto, and user id', async () => {
      // Arrange
      mockCheeksService.updateCheeks.mockResolvedValueOnce(updatedCheek);

      // Act
      const result = await controller.update(cheekId, updateDto, req);

      // Assert
      expect(service.updateCheeks).toHaveBeenCalledWith(cheekId, updateDto, userPayload.id);
      expect(result).toEqual(updatedCheek);
    });

    it('should propagate errors from the service when update fails', async () => {
      const error = new InternalServerErrorException('Update failed');
      mockCheeksService.updateCheeks.mockRejectedValueOnce(error);

      await expect(controller.update(cheekId, updateDto, req)).rejects.toThrow(InternalServerErrorException);
      expect(service.updateCheeks).toHaveBeenCalledWith(cheekId, updateDto, userPayload.id);
    });
  });

  // --- Test remove ---
  describe('remove', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const userPayload = { id: new Types.ObjectId().toHexString(), username: 'deleter' };
    const req = mockRequest(userPayload);
    const deleteResult = { message: 'Cheeks deleted successfully' };

    it('should call service.deleteCheeks with id and user id', async () => {
        // Arrange
        mockCheeksService.deleteCheeks.mockResolvedValueOnce(deleteResult);

        // Act
        const result = await controller.remove(cheekId, req);

        // Assert
        expect(service.deleteCheeks).toHaveBeenCalledWith(cheekId, userPayload.id);
        expect(result).toEqual(deleteResult);
    });

    it('should propagate errors from the service when deletion fails', async () => {
      const error = new InternalServerErrorException('Deletion failed');
      mockCheeksService.deleteCheeks.mockRejectedValueOnce(error);

      await expect(controller.remove(cheekId, req)).rejects.toThrow(InternalServerErrorException);
      expect(service.deleteCheeks).toHaveBeenCalledWith(cheekId, userPayload.id);
    });
  });
});
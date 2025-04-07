// src/cheeks/cheeks.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { CheeksController } from './cheeks.controller';
import { CheeksService } from './cheeks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheeksDto } from './dto/cheeks.dto';
import { UpdateCheeksDto } from './dto/update-cheeks.dto';

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
    const cheeksDto: CheeksDto = { title: 'New Cheek', description: 'd', category: 'c', links: [{ title: 't', url: 'u' }], tags: [], isPublic: false };
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
  });
});
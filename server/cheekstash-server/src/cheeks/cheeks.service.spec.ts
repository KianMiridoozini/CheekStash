// src/cheeks/cheeks.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose'; // <-- Import getModelToken
import { Model, Types } from 'mongoose';
import { CheeksService } from './cheeks.service';
import { Cheeks, CheeksDocument } from './schemas/cheeks.schema'; // <-- Import Schema Class
import { CheeksDto } from './dto/cheeks.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
// import { LinkDto } from './dto/link.dto'; 

// --- Mocking Setup (Consistent with users/auth) ---
const mockStaticMethods = {
  find: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

// Update mockDocument to match CheeksDto/Schema structure
const mockDocument = (dto: Partial<CheeksDto> = {}, ownerId?: string) => ({
  title: dto.title || 'Default Title',
  description: dto.description || 'Default Desc',
  category: dto.category || 'Default Cat',
  tags: dto.tags || [],
  isPublic: dto.isPublic !== undefined ? dto.isPublic : true,
  links: dto.links || [],
  _id: (dto as any)._id || new Types.ObjectId(), 
  owner: new Types.ObjectId(ownerId || new Types.ObjectId().toHexString()),
  save: jest.fn().mockResolvedValue({
    title: dto.title || 'Default Title',
    description: dto.description || 'Default Desc',
    category: dto.category || 'Default Cat',
    tags: dto.tags || [],
    isPublic: dto.isPublic !== undefined ? dto.isPublic : true,
    links: dto.links || [],
    _id: (dto as any)._id || new Types.ObjectId(),
    owner: new Types.ObjectId(ownerId || new Types.ObjectId().toHexString()),
  }),
  toString: jest
    .fn()
    .mockReturnValue(
      JSON.stringify({ ...dto, _id: (dto as any)._id, owner: ownerId }),
    ),
});

const mockQuery = (resolveValue: any = null) => ({
  exec: jest.fn().mockResolvedValue(resolveValue),
  select: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
});

const createMockCheeksModel = () => {
  const model = jest.fn().mockImplementation((dto) => mockDocument(dto)); // Mock constructor
  // Assign static methods using Object.assign is generally fine here
  return Object.assign(model, mockStaticMethods);
};
// --- End Mocking Setup ---

describe('CheeksService', () => {
  let service: CheeksService;
  let cheeksModel: jest.Mock & typeof mockStaticMethods;

  beforeEach(async () => {
    jest.clearAllMocks(); // Clear mocks first

    cheeksModel = createMockCheeksModel();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheeksService,
        {
          provide: getModelToken(Cheeks.name),
          useValue: cheeksModel, 
        },
      ],
    }).compile();

    service = module.get<CheeksService>(CheeksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Test createCheeks ---
  describe('createCheeks', () => {
    const ownerId = new Types.ObjectId().toHexString();
    const cheeksDto: CheeksDto = {
      title: 'Test Cheek',
      description: 'Desc',
      category: 'Tech',
      tags: ['testing', 'ai'],
      isPublic: true,
      links: [
        { title: 't', url: 'u', description: 'd', order: 0 },
        { title: 't2', url: 'u2', description: 'd2', order: 1 },
      ], 
    };
    const savedCheekDoc = mockDocument({ ...cheeksDto }, ownerId);

    it('should create and save a new cheek', async () => {
      const mockSave = jest.fn().mockResolvedValue(savedCheekDoc);
      cheeksModel.mockImplementationOnce(() => ({
        ...cheeksDto,
        owner: ownerId,
        save: mockSave,
      }));

      const result = await service.createCheeks(cheeksDto, ownerId);

      expect(cheeksModel).toHaveBeenCalledWith({
        ...cheeksDto,
        owner: ownerId,
      });
      expect(mockSave).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          title: cheeksDto.title, 
          owner: new Types.ObjectId(ownerId),
        }),
      );
    });
  });

  // --- Test getCheeks ---
  describe('getCheeks', () => {
    it('should return an array of cheeks', async () => {
      const cheeksData = [
        mockDocument({ title: 'Cheek 1' }),
        mockDocument({ title: 'Cheek 2' }),
      ];
      const mockFindQuery = mockQuery(cheeksData);
      cheeksModel.find.mockReturnValueOnce(mockFindQuery as any);

      const result = await service.getCheeks();

      expect(cheeksModel.find).toHaveBeenCalled();
      expect(mockFindQuery.exec).toHaveBeenCalled();
      expect(result).toEqual(cheeksData);
    });
  });

  // --- Test getCheeksById ---
  describe('getCheeksById', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const cheekData = mockDocument({ title: 'Found Cheek' });

    it('should return a cheek if found', async () => {
      const mockFindByIdQuery = mockQuery(cheekData);
      cheeksModel.findById.mockReturnValueOnce(mockFindByIdQuery as any);

      const result = await service.getCheeksById(cheekId);

      expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
      expect(mockFindByIdQuery.exec).toHaveBeenCalled();
      expect(result).toEqual(cheekData);
    });

    it('should throw NotFoundException if cheek not found', async () => {
      const mockFindByIdQuery = mockQuery(null);
      cheeksModel.findById.mockReturnValueOnce(mockFindByIdQuery as any);

      await expect(service.getCheeksById(cheekId)).rejects.toThrow(
        NotFoundException,
      );
      expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
      expect(mockFindByIdQuery.exec).toHaveBeenCalled();
    });
  });

  // --- Test updateCheeks ---
  describe('updateCheeks', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const ownerId = new Types.ObjectId().toHexString();
    const nonOwnerId = new Types.ObjectId().toHexString();
    const updateDto: Partial<CheeksDto> = { description: 'Updated Desc' };
    const originalCheekDoc = mockDocument(
      { title: 'Original', description: 'Orig Desc' },
      ownerId,
    );
    const updatedCheekDoc = mockDocument(
      { title: 'Original', description: 'Updated Desc' },
      ownerId,
    );

    it('should update the cheek if user is the owner', async () => {
      cheeksModel.findById.mockResolvedValueOnce(originalCheekDoc);
      cheeksModel.findOneAndUpdate.mockResolvedValueOnce(updatedCheekDoc);

      const result = await service.updateCheeks(cheekId, updateDto, ownerId);

      expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
      expect(cheeksModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: cheekId, owner: ownerId },
        updateDto,
        { new: true, runValidators: true },
      );
      expect(result).toEqual(updatedCheekDoc);
    });

    it('should throw NotFoundException if cheek to update is not found (findById)', async () => {
      // Arrange
      cheeksModel.findById.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.updateCheeks(cheekId, updateDto, ownerId),
      ).rejects.toThrow(NotFoundException);
      expect(cheeksModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      // Arrange
      cheeksModel.findById.mockResolvedValueOnce(originalCheekDoc); 

      // Act & Assert
      await expect(
        service.updateCheeks(cheekId, updateDto, nonOwnerId),
      ).rejects.toThrow(ForbiddenException);
      expect(cheeksModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if findOneAndUpdate returns null (e.g., concurrent delete)', async () => {
      // Arrange
      cheeksModel.findById.mockResolvedValueOnce(originalCheekDoc);
      cheeksModel.findOneAndUpdate.mockResolvedValueOnce(null); 

      // Act & Assert
      await expect(
        service.updateCheeks(cheekId, updateDto, ownerId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // --- Test deleteCheeks ---
  describe('deleteCheeks', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const ownerId = new Types.ObjectId().toHexString();
    const nonOwnerId = new Types.ObjectId().toHexString();
    const cheekDoc = mockDocument({ title: 'To Delete' }, ownerId);

    it('should delete the cheek if user is the owner', async () => {
      cheeksModel.findById.mockResolvedValueOnce(cheekDoc);
      cheeksModel.findByIdAndDelete.mockResolvedValueOnce(cheekDoc);

      const result = await service.deleteCheeks(cheekId, ownerId);

      expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
      expect(cheeksModel.findByIdAndDelete).toHaveBeenCalledWith(cheekId);
      expect(result).toEqual({ message: 'Cheeks deleted successfully' });
    });

    it('should throw NotFoundException if cheek to delete is not found', async () => {
      // Arrange
      cheeksModel.findById.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.deleteCheeks(cheekId, ownerId)).rejects.toThrow(
        NotFoundException,
      );
      expect(cheeksModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      // Arrange
      cheeksModel.findById.mockResolvedValueOnce(cheekDoc);

      // Act & Assert
      await expect(service.deleteCheeks(cheekId, nonOwnerId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(cheeksModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});

// src/cheeks/cheeks.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CheeksService } from './cheeks.service';
import { Cheeks, CheeksDocument } from './schemas/cheek.schema';
import { CheeksDto } from './dto/cheeks.dto';
import { UpdateCheeksDto } from './dto/update-cheeks.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Category, CategoryDocument } from '../categories/schema/category.schema';
import { Tag, TagDocument } from '../tags/schema/tag.schema';
import { CategoriesService } from '../categories/categories.service';
import { TagsService } from '../tags/tags.service';

const mockStaticMethods = {
  find: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

const mockDocument = (dto: Partial<CheeksDto & { tagIds: string[] }> = {}, ownerId?: string) => ({
  title: dto.title || 'Default Title',
  description: dto.description || 'Default Desc',
  categoryId: dto.categoryId || new Types.ObjectId().toHexString(),
  tagNames: dto.tagNames || [],
  isPublic: dto.isPublic !== undefined ? dto.isPublic : true,
  links: dto.links || [],
  _id: (dto as any)._id || new Types.ObjectId(),
  owner: new Types.ObjectId(ownerId || new Types.ObjectId().toHexString()),
  save: jest.fn().mockResolvedValue({
    title: dto.title || 'Default Title',
    description: dto.description || 'Default Desc',
    categoryId: dto.categoryId || new Types.ObjectId().toHexString(),
    tagNames: dto.tagNames || [],
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
  const model = jest.fn().mockImplementation((dto) => mockDocument(dto));
  return Object.assign(model, mockStaticMethods);
};

describe('CheeksService', () => {
  let service: CheeksService;
  let cheeksModel: jest.Mock & typeof mockStaticMethods;
  let mockCategoryModel: any;
  let mockTagModel: any;
  let tagsServiceMock: TagsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    cheeksModel = createMockCheeksModel();
    mockCategoryModel = { findById: jest.fn(), find: jest.fn() };
    mockTagModel = { findById: jest.fn(), find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheeksService,
        {
          provide: getModelToken(Cheeks.name),
          useValue: cheeksModel,
        },
        {
          provide: getModelToken(Category.name),
          useValue: mockCategoryModel,
        },
        {
          provide: getModelToken(Tag.name),
          useValue: mockTagModel,
        },
        {
          provide: CategoriesService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({ _id: 'mockCategoryId', name: 'Mock Category' }),
          },
        },
        {
          provide: TagsService,
          useValue: {
            findOrCreateTags: jest.fn().mockResolvedValue([]),
            updateTagUsageCount: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<CheeksService>(CheeksService);
    tagsServiceMock = module.get<TagsService>(TagsService);

    jest.spyOn(tagsServiceMock, 'updateTagUsageCount').mockResolvedValue(null); // Simplified mock return
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheeks', () => {
    const ownerId = new Types.ObjectId().toHexString();
    const categoryId = new Types.ObjectId().toHexString();
    const cheeksDto: CheeksDto = {
      title: 'Test Cheek',
      description: 'Desc',
      categoryId: categoryId,
      tagNames: ['tag1', 'tag2'],
      isPublic: true,
      links: [
        { title: 't', url: 'u', description: 'd', order: 0 },
        { title: 't2', url: 'u2', description: 'd2', order: 1 },
      ],
    };
    const savedCheekDoc = {
      ...mockDocument({ ...cheeksDto }, ownerId),
      tagIds: [new Types.ObjectId(), new Types.ObjectId()],
      populate: jest.fn().mockImplementation(function (this: any, paths: any) {
        if (paths.some((p: any) => p.path === 'categoryId')) {
          this.categoryId = { _id: categoryId, name: 'Mock Populated Category' };
        }
        if (paths.some((p: any) => p.path === 'tagIds')) {
          this.tagIds = (this.tagIds || []).map((id: Types.ObjectId) => ({
            _id: id,
            name: `Mock Populated Tag ${id.toHexString()}`,
          }));
        }
        return Promise.resolve(this);
      }),
    };

    it('should create and save a new cheek', async () => {
      const mockSave = jest.fn().mockResolvedValue(savedCheekDoc);
      cheeksModel.mockImplementationOnce(() => ({
        ...cheeksDto,
        owner: ownerId,
        save: mockSave,
      }));

      jest.spyOn(service['categoriesService'], 'findOne').mockResolvedValue({
        _id: categoryId,
        name: 'Mock Category From Service',
      } as any);
      jest.spyOn(tagsServiceMock, 'findOrCreateTags').mockResolvedValue(
        savedCheekDoc.tagIds.map((id) => ({
          _id: id,
          name: `Mock Tag ${id.toHexString()}`,
        })) as any,
      );

      const result = await service.createCheeks(cheeksDto, ownerId);

      expect(cheeksModel).toHaveBeenCalledWith(
        expect.objectContaining({
          ...cheeksDto,
          owner: ownerId,
        }),
      );
      expect(mockSave).toHaveBeenCalled();
      expect(savedCheekDoc.populate).toHaveBeenCalledWith([
        { path: 'categoryId' },
        { path: 'tagIds' },
      ]);

      expect(result).toEqual(
        expect.objectContaining({
          title: cheeksDto.title,
          owner: new Types.ObjectId(ownerId),
          categoryId: expect.objectContaining({ _id: categoryId, name: 'Mock Populated Category' }),
          tagIds: expect.arrayContaining([
            expect.objectContaining({ name: expect.stringContaining('Mock Populated Tag') }),
          ]),
        }),
      );
      expect(result.tagIds.length).toBe(2);
    });
  });

  describe('getCheeks', () => {
    it('should return an array of cheeks with populated category and tags', async () => {
      const categoryObj = { _id: new Types.ObjectId(), name: 'Populated Category' };
      const tagObj = { _id: new Types.ObjectId(), name: 'Populated Tag' };
      const cheeksData = [
        mockDocument({ title: 'Cheek 1', categoryId: categoryObj._id.toHexString(), tagNames: ['tagA'] }),
        mockDocument({ title: 'Cheek 2' }),
      ];
      const mockExec = jest.fn().mockResolvedValue(
        cheeksData.map((cheek) => ({
          ...cheek,
          categoryId: categoryObj,
          tagIds: [tagObj],
        })),
      );
      const mockPopulateTags = jest.fn().mockReturnThis();
      const mockPopulateCategory = jest.fn().mockReturnThis();
      cheeksModel.find.mockReturnValueOnce({
        populate: mockPopulateCategory.mockImplementation((path: string) => {
          if (path === 'categoryId')
            return {
              populate: mockPopulateTags.mockImplementation((path2: string) => {
                if (path2 === 'tagIds') return { exec: mockExec };
                return { exec: mockExec };
              }),
            };
          return { exec: mockExec };
        }),
        exec: mockExec,
      } as any);

      const result = await service.getCheeks();

      expect(cheeksModel.find).toHaveBeenCalled();
      expect(mockPopulateCategory).toHaveBeenCalledWith('categoryId');
      expect(mockPopulateTags).toHaveBeenCalledWith('tagIds');
      expect(mockExec).toHaveBeenCalled();
      expect(result[0].categoryId).toEqual(categoryObj);
      expect(result[0].tagIds).toEqual([tagObj]);
    });
  });

  describe('getCheeksById', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const categoryObj = { _id: new Types.ObjectId(), name: 'Populated Category Single' };
    const tagObj = { _id: new Types.ObjectId(), name: 'Populated Tag Single' };
    const cheekData = mockDocument({
      title: 'Found Cheek',
      categoryId: categoryObj._id.toHexString(),
      tagNames: ['tagB'],
    });

    it('should return a cheek with populated category and tags if found', async () => {
      const mockExec = jest.fn().mockResolvedValue({
        ...cheekData,
        categoryId: categoryObj,
        tagIds: [tagObj],
      });
      const mockPopulateTags = jest.fn().mockReturnThis();
      const mockPopulateCategory = jest.fn().mockReturnThis();

      cheeksModel.findById.mockReturnValueOnce({
        populate: mockPopulateCategory.mockImplementation((path: string) => {
          if (path === 'categoryId')
            return {
              populate: mockPopulateTags.mockImplementation((path2: string) => {
                if (path2 === 'tagIds') return { exec: mockExec };
                return { exec: mockExec };
              }),
            };
          return { exec: mockExec };
        }),
        exec: mockExec,
      } as any);

      const result = await service.getCheeksById(cheekId);

      expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
      expect(mockPopulateCategory).toHaveBeenCalledWith('categoryId');
      expect(mockPopulateTags).toHaveBeenCalledWith('tagIds');
      expect(mockExec).toHaveBeenCalled();
      expect(result.categoryId).toEqual(categoryObj);
      expect(result.tagIds).toEqual([tagObj]);
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

  describe('updateCheeks', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const ownerId = new Types.ObjectId().toHexString();
    const newCategoryId = new Types.ObjectId().toHexString();
    const updateDto: Partial<CheeksDto> = { description: 'Updated Desc', categoryId: newCategoryId, tagNames: ['new-tag'] };
    const originalCheekDoc = {
      ...mockDocument(
        { title: 'Original', description: 'Orig Desc', categoryId: new Types.ObjectId().toHexString(), tagNames: ['old-tag'] },
        ownerId,
      ),
      tagIds: [new Types.ObjectId()],
      categoryId: new Types.ObjectId(new Types.ObjectId().toHexString()),
      owner: new Types.ObjectId(ownerId),
      save: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
    };
    const updatedCheekDataFromDb = {
      ...originalCheekDoc,
      description: 'Updated Desc',
      categoryId: new Types.ObjectId(newCategoryId),
      tagIds: [new Types.ObjectId()],
      populate: jest.fn().mockImplementation(function (this: any, paths: any) {
        if (paths.find((p: any) => p.path === 'categoryId')) {
          this.categoryId = { _id: newCategoryId, name: 'Updated Category' };
        }
        if (paths.find((p: any) => p.path === 'tagIds')) {
          this.tagIds = (this.tagIds || []).map((tagId: Types.ObjectId) => ({ _id: tagId, name: 'new-tag' }));
        }
        return Promise.resolve(this);
      }),
    };

    it('should update the cheek and return populated data if user is the owner', async () => {
      cheeksModel.findById.mockResolvedValueOnce(originalCheekDoc);
      cheeksModel.findOneAndUpdate.mockResolvedValueOnce(updatedCheekDataFromDb);

      jest.spyOn(service['categoriesService'], 'findOne').mockResolvedValue({
        _id: newCategoryId, name: 'Updated Category'
      } as any);

      const newTagObjectId = updatedCheekDataFromDb.tagIds[0];
      jest.spyOn(tagsServiceMock, 'findOrCreateTags').mockResolvedValueOnce([{ _id: newTagObjectId, name: 'new-tag' }] as any);

      const result = await service.updateCheeks(cheekId, updateDto as UpdateCheeksDto, ownerId);

      expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
      expect(cheeksModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: cheekId, owner: ownerId },
        expect.objectContaining({
          description: 'Updated Desc',
          categoryId: newCategoryId,
          tagIds: [newTagObjectId],
        }),
        { new: true, runValidators: true },
      );
      expect(updatedCheekDataFromDb.populate).toHaveBeenCalledWith([
        { path: 'categoryId' },
        { path: 'tagIds' },
      ]);
      expect(result.description).toEqual('Updated Desc');
      expect(result.categoryId).toEqual(expect.objectContaining({
        _id: newCategoryId,
        name: 'Updated Category',
      }));
      expect(result.tagIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ _id: newTagObjectId, name: 'new-tag' }),
      ]));
    });

    it('should throw NotFoundException if findOneAndUpdate returns null', async () => {
      cheeksModel.findById.mockResolvedValueOnce(originalCheekDoc);
      cheeksModel.findOneAndUpdate.mockResolvedValueOnce(null);

      if (updateDto.categoryId) {
        jest.spyOn(service['categoriesService'], 'findOne').mockResolvedValue({ _id: newCategoryId, name: 'Any Category' } as any);
      }
      if (updateDto.tagNames !== undefined) {
        jest.spyOn(tagsServiceMock, 'findOrCreateTags').mockResolvedValueOnce([]);
      }

      await expect(
        service.updateCheeks(cheekId, updateDto as UpdateCheeksDto, ownerId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCheeks', () => {
    const cheekId = new Types.ObjectId().toHexString();
    const ownerId = new Types.ObjectId().toHexString();
    const nonOwnerId = new Types.ObjectId().toHexString();
    const cheekDoc = {
      ...mockDocument({ title: 'To Delete', tagNames: ['tag-to-decrement'] }, ownerId),
      tagIds: [new Types.ObjectId()],
      owner: new Types.ObjectId(ownerId),
    };

    it('should delete the cheek if user is the owner and decrement tag counts', async () => {
      cheeksModel.findById.mockResolvedValueOnce(cheekDoc);
      cheeksModel.findByIdAndDelete.mockResolvedValueOnce(cheekDoc);

      (service as any).tagsService = {
        updateTagUsageCount: jest.fn().mockResolvedValue(null),
      };

      const result = await service.deleteCheeks(cheekId, ownerId);

      expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
      expect(cheeksModel.findByIdAndDelete).toHaveBeenCalledWith(cheekId);
      expect((service as any).tagsService.updateTagUsageCount).toHaveBeenCalledWith(
        cheekDoc.tagIds[0].toString(),
        -1,
      );
      expect(result).toEqual({ message: 'Cheeks deleted successfully' });
    });

    it('should throw NotFoundException if cheek to delete is not found', async () => {
      cheeksModel.findById.mockResolvedValueOnce(null);

      await expect(service.deleteCheeks(cheekId, ownerId)).rejects.toThrow(
        NotFoundException,
      );
      expect(cheeksModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      cheeksModel.findById.mockResolvedValueOnce(cheekDoc);

      await expect(service.deleteCheeks(cheekId, nonOwnerId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(cheeksModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});

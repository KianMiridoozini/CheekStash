// // src/cheeks/cheeks.service.spec.ts
// import { Test, TestingModule } from '@nestjs/testing';
// import { getModelToken } from '@nestjs/mongoose';
// import { Model, Types } from 'mongoose';
// import { CheeksService } from './cheeks.service';
// import { Cheeks, CheeksDocument } from './schemas/cheek.schema';
// import { CheeksDto } from './dto/cheeks.dto';
// import { UpdateCheeksDto } from './dto/update-cheeks.dto';
// import { NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
// import { Category } from '../categories/schema/category.schema'; // Removed Document suffix
// import { Tag } from '../tags/schema/tag.schema'; // Removed Document suffix
// import { CategoriesService } from '../categories/categories.service';
// import { TagsService } from '../tags/tags.service';

// const mockStaticMethods = {
//   find: jest.fn(),
//   findById: jest.fn(),
//   findOneAndUpdate: jest.fn(),
//   findByIdAndDelete: jest.fn(),
// };

// // Represents the raw data of a cheek document, not an instance with methods
// const mockCheekData = (dto: Partial<CheeksDto & { _id?: Types.ObjectId | string, owner?: Types.ObjectId | string, categoryId?: Types.ObjectId | string, tagIds?: Types.ObjectId[] }> = {}) => ({
//   _id: dto._id || new Types.ObjectId(),
//   title: dto.title || 'Default Title',
//   description: dto.description || 'Default Desc',
//   categoryId: new Types.ObjectId(dto.categoryId?.toString() || new Types.ObjectId().toHexString()),
//   tagIds: dto.tagIds || [],
//   isPublic: dto.isPublic !== undefined ? dto.isPublic : true,
//   links: dto.links || [],
//   owner: new Types.ObjectId(dto.owner?.toString() || new Types.ObjectId().toHexString()),
//   // Removed save and toString from here
// });


// const mockQuery = (resolveValue: any = null) => ({
//   exec: jest.fn().mockResolvedValue(resolveValue),
//   select: jest.fn().mockReturnThis(),
//   populate: jest.fn().mockReturnThis(), // Key for testing populate calls
// });

// // Factory for CheeksModel mock
// const createMockCheeksModel = () => {
//   // The constructor mock. `new this.CheeksModel(data)` is called in service.
//   // It should return an object that has a `save` method.
//   const modelConstructor = jest.fn().mockImplementation((data) => {
//     // Data passed to constructor by service
//     const instanceData = {
//       ...data, // includes owner (string), categoryId (string from DTO), tagIds (ObjectId[] from service)
//       _id: data._id || new Types.ObjectId(), // Mongoose typically adds _id on instantiation or save
//       owner: new Types.ObjectId(data.owner), // Ensure owner is ObjectId
//       categoryId: new Types.ObjectId(data.categoryId), // Ensure categoryId is ObjectId
//     };

//     // The object returned by `save()` should have `populate()`
//     const savedDocWithPopulate = {
//       ...instanceData,
//       populate: jest.fn().mockImplementation(function(this: any, paths: any) {
//         // Simulate population
//         const populatedVersion = { ...this };
//         const pathArray = Array.isArray(paths) ? paths : [paths];
//         if (pathArray.some((p: any) => p.path === 'categoryId' || p === 'categoryId')) {
//           populatedVersion.categoryId = { _id: this.categoryId, name: 'Mock Populated Category' };
//         }
//         if (pathArray.some((p: any) => p.path === 'tagIds' || p === 'tagIds')) {
//           populatedVersion.tagIds = (this.tagIds || []).map((id: Types.ObjectId) => ({
//             _id: id,
//             name: `Mock Populated Tag ${id.toHexString()}`,
//           }));
//         }
//         return Promise.resolve(populatedVersion);
//       }),
//     };
//     return {
//       ...instanceData,
//       save: jest.fn().mockResolvedValue(savedDocWithPopulate),
//     };
//   });
//   return Object.assign(modelConstructor, mockStaticMethods);
// };

// describe('CheeksService', () => {
//   let service: CheeksService;
//   let cheeksModel: ReturnType<typeof createMockCheeksModel>; // Correct type
//   let categoriesServiceMock: CategoriesService;
//   let tagsServiceMock: TagsService;

//   beforeEach(async () => {
//     jest.clearAllMocks(); // Clear all mocks

//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         CheeksService,
//         {
//           provide: getModelToken(Cheeks.name),
//           useValue: createMockCheeksModel(), // Use the factory
//         },
//         {
//           provide: CategoriesService,
//           useValue: { // Mock methods used by CheeksService
//             findOne: jest.fn(),
//           },
//         },
//         {
//           provide: TagsService,
//           useValue: { // Mock methods used by CheeksService
//             findOrCreateTags: jest.fn(),
//             updateTagUsageCount: jest.fn(),
//           },
//         },
//         // Removed Category and Tag model providers as they are not directly injected into CheeksService
//       ],
//     }).compile();

//     service = module.get<CheeksService>(CheeksService);
//     cheeksModel = module.get(getModelToken(Cheeks.name));
//     categoriesServiceMock = module.get<CategoriesService>(CategoriesService);
//     tagsServiceMock = module.get<TagsService>(TagsService);
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('createCheeks', () => {
//     const ownerId = new Types.ObjectId().toHexString();
//     const categoryId = new Types.ObjectId();
//     const cheeksDto: CheeksDto = {
//       title: 'Test Cheek',
//       description: 'Desc',
//       categoryId: categoryId.toHexString(),
//       tagNames: ['tag1', 'tag2'],
//       isPublic: true,
//       links: [{ title: 't', url: 'u', description: 'd', order: 0 }],
//     };

//     const mockTagDoc1 = { _id: new Types.ObjectId(), name: 'tag1' };
//     const mockTagDoc2 = { _id: new Types.ObjectId(), name: 'tag2' };
//     const mockTagDocs = [mockTagDoc1, mockTagDoc2];
//     const mockTagIds = mockTagDocs.map(t => t._id);

//     beforeEach(() => {
//       (categoriesServiceMock.findOne as jest.Mock).mockResolvedValue({ _id: categoryId, name: 'Mock Category' });
//       (tagsServiceMock.findOrCreateTags as jest.Mock).mockResolvedValue(mockTagDocs);
//       (tagsServiceMock.updateTagUsageCount as jest.Mock).mockResolvedValue(null);
//     });

//     it('should create, save, and populate a new cheek', async () => {
//       const result = await service.createCheeks(cheeksDto, ownerId);

//       expect(categoriesServiceMock.findOne).toHaveBeenCalledWith(cheeksDto.categoryId);
//       expect(tagsServiceMock.findOrCreateTags).toHaveBeenCalledWith(cheeksDto.tagNames);
//       expect(tagsServiceMock.updateTagUsageCount).toHaveBeenCalledTimes(mockTagDocs.length);
//       expect(tagsServiceMock.updateTagUsageCount).toHaveBeenCalledWith(mockTagDoc1._id.toString(), 1);
//       expect(tagsServiceMock.updateTagUsageCount).toHaveBeenCalledWith(mockTagDoc2._id.toString(), 1);

//       expect(cheeksModel).toHaveBeenCalledWith({
//         ...cheeksDto, // categoryId is string here
//         owner: ownerId, // ownerId is string
//         tagIds: mockTagIds, // tagIds are ObjectIds
//       });
      
//       // Access the instance created by the constructor mock to check its save method
//       const mockInstance = cheeksModel.mock.results[0].value;
//       expect(mockInstance.save).toHaveBeenCalled();

//       // Access the populate mock on the result of save
//       const savedDocWithPopulate = await mockInstance.save();
//       expect(savedDocWithPopulate.populate).toHaveBeenCalledWith([
//         { path: 'categoryId' },
//         { path: 'tagIds' },
//       ]);
      
//       expect(result.title).toBe(cheeksDto.title);
//       expect(result.owner.toString()).toBe(ownerId); // Compare string versions or use .toEqual(new Types.ObjectId(ownerId))
//       expect(result.categoryId).toEqual({ _id: categoryId, name: 'Mock Populated Category' });
//       expect(result.tagIds).toEqual(
//         mockTagIds.map(id => ({ _id: id, name: `Mock Populated Tag ${id.toHexString()}` }))
//       );
//     });

//     it('should throw InternalServerErrorException if save fails', async () => {
//       const saveError = new Error('DB save failed');
//       // Make the constructor return an instance whose save method rejects
//       cheeksModel.mockImplementationOnce(() => ({
//         save: jest.fn().mockRejectedValue(saveError),
//       }));

//       await expect(service.createCheeks(cheeksDto, ownerId)).rejects.toThrow(
//         new InternalServerErrorException('Error saving new Cheeks: ' + saveError.message)
//       );
//     });
//   });

//   describe('getCheeks', () => {
//     it('should return an array of cheeks with populated category and tags', async () => {
//       const categoryData = { _id: new Types.ObjectId(), name: 'Populated Category' };
//       const tagData = [{ _id: new Types.ObjectId(), name: 'Populated Tag' }];
//       const rawCheeks = [
//         mockCheekData({ categoryId: categoryData._id.toHexString(), tagIds: tagData.map(t=>t._id) }),
//       ];
//       const populatedCheeks = rawCheeks.map(c => ({ ...c, categoryId: categoryData, tagIds: tagData }));
      
//       const query = mockQuery(populatedCheeks);
//       cheeksModel.find.mockReturnValue(query);

//       const result = await service.getCheeks();

//       expect(cheeksModel.find).toHaveBeenCalled();
//       expect(query.populate).toHaveBeenCalledWith('categoryId');
//       expect(query.populate).toHaveBeenCalledWith('tagIds');
//       expect(query.exec).toHaveBeenCalled();
//       expect(result).toEqual(populatedCheeks);
//     });
//   });

//   describe('getCheeksById', () => {
//     const cheekId = new Types.ObjectId().toHexString();
//     const categoryData = { _id: new Types.ObjectId(), name: 'Populated Category Single' };
//     const tagData = [{ _id: new Types.ObjectId(), name: 'Populated Tag Single' }];
//     const rawCheek = mockCheekData({ _id: new Types.ObjectId(cheekId), categoryId: categoryData._id.toHexString(), tagIds: tagData.map(t=>t._id) });
//     const populatedCheek = { ...rawCheek, categoryId: categoryData, tagIds: tagData };

//     it('should return a cheek with populated category and tags if found', async () => {
//       const query = mockQuery(populatedCheek);
//       cheeksModel.findById.mockReturnValue(query);

//       const result = await service.getCheeksById(cheekId);

//       expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
//       expect(query.populate).toHaveBeenCalledWith('categoryId');
//       expect(query.populate).toHaveBeenCalledWith('tagIds');
//       expect(query.exec).toHaveBeenCalled();
//       expect(result).toEqual(populatedCheek);
//     });

//     it('should throw NotFoundException if cheek not found', async () => {
//       const query = mockQuery(null);
//       cheeksModel.findById.mockReturnValue(query);
//       await expect(service.getCheeksById(cheekId)).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('updateCheeks', () => {
//     const cheekId = new Types.ObjectId().toHexString();
//     const ownerId = new Types.ObjectId().toHexString();
//     const originalCategoryId = new Types.ObjectId();
//     const newCategoryId = new Types.ObjectId();
//     const originalTag1 = { _id: new Types.ObjectId(), name: 'old-tag1' };
//     const newTag1 = { _id: new Types.ObjectId(), name: 'new-tag1' };

//     const originalCheekDoc = {
//       _id: new Types.ObjectId(cheekId),
//       title: 'Original Title',
//       description: 'Original Desc',
//       categoryId: originalCategoryId,
//       tagIds: [originalTag1._id],
//       owner: new Types.ObjectId(ownerId),
//       isPublic: true,
//       links: [],
//       // Add toString for owner comparison if needed, or ensure owner is compared as ObjectId
//       // For `originalCheek.owner.toString() !== userId`
//     };

//     const updateDto: UpdateCheeksDto = {
//       title: 'Updated Title',
//       categoryId: newCategoryId.toHexString(),
//       tagNames: [newTag1.name],
//     };

//     const dbUpdatedCheekData = { // Data after findOneAndUpdate, before populate
//       ...originalCheekDoc,
//       title: updateDto.title,
//       categoryId: newCategoryId, // Should be ObjectId
//       tagIds: [newTag1._id], // Should be ObjectId[]
//     };
    
//     const finalPopulatedCheek = { // Data after populate
//         ...dbUpdatedCheekData,
//         categoryId: { _id: newCategoryId, name: 'Populated New Category' },
//         tagIds: [{ _id: newTag1._id, name: 'Populated New Tag' }],
//     };

//     // Mock for the document instance returned by findOneAndUpdate, which then has .populate() called
//     const mockUpdatedDocInstanceWithPopulate = {
//         ...dbUpdatedCheekData,
//         populate: jest.fn().mockResolvedValue(finalPopulatedCheek)
//     };

//     beforeEach(() => {
//       cheeksModel.findById.mockResolvedValue(originalCheekDoc); // findById returns the raw doc
//       cheeksModel.findOneAndUpdate.mockResolvedValue(mockUpdatedDocInstanceWithPopulate); // findOneAndUpdate returns the doc that will be populated

//       (categoriesServiceMock.findOne as jest.Mock)
//         .mockImplementation(async (id: string) => {
//           if (id === newCategoryId.toHexString()) return { _id: newCategoryId, name: 'Populated New Category' };
//           if (id === originalCategoryId.toHexString()) return { _id: originalCategoryId, name: 'Populated Original Category' };
//           return null;
//         });
//       (tagsServiceMock.findOrCreateTags as jest.Mock).mockResolvedValue([newTag1]);
//       (tagsServiceMock.updateTagUsageCount as jest.Mock).mockResolvedValue(null);
//     });

//     it('should update the cheek, handle tags, and return populated data if user is the owner', async () => {
//       const result = await service.updateCheeks(cheekId, updateDto, ownerId);

//       expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
//       expect(categoriesServiceMock.findOne).toHaveBeenCalledWith(newCategoryId.toHexString());
//       expect(tagsServiceMock.findOrCreateTags).toHaveBeenCalledWith(updateDto.tagNames);
//       expect(tagsServiceMock.updateTagUsageCount).toHaveBeenCalledWith(newTag1._id.toString(), 1); // Added
//       expect(tagsServiceMock.updateTagUsageCount).toHaveBeenCalledWith(originalTag1._id.toString(), -1); // Removed
      
//       expect(cheeksModel.findOneAndUpdate).toHaveBeenCalledWith(
//         { _id: cheekId, owner: ownerId }, // ownerId is string here as per service
//         expect.objectContaining({
//           title: updateDto.title,
//           categoryId: updateDto.categoryId, // string from DTO
//           tagIds: [newTag1._id], // ObjectIds from service logic
//         }),
//         { new: true, runValidators: true },
//       );
//       expect(mockUpdatedDocInstanceWithPopulate.populate).toHaveBeenCalledWith([
//         { path: 'categoryId' },
//         { path: 'tagIds' },
//       ]);
//       expect(result).toEqual(finalPopulatedCheek);
//     });

//     it('should throw NotFoundException if original cheek not found', async () => {
//       cheeksModel.findById.mockResolvedValue(null);
//       await expect(service.updateCheeks(cheekId, updateDto, ownerId)).rejects.toThrow(NotFoundException);
//     });

//     it('should throw ForbiddenException if user is not the owner', async () => {
//       const nonOwnerId = new Types.ObjectId().toHexString();
//       await expect(service.updateCheeks(cheekId, updateDto, nonOwnerId)).rejects.toThrow(ForbiddenException);
//     });
    
//     it('should throw NotFoundException if findOneAndUpdate returns null (e.g. update failed post-auth)', async () => {
//       cheeksModel.findOneAndUpdate.mockResolvedValue(null);
//       await expect(service.updateCheeks(cheekId, updateDto, ownerId)).rejects.toThrow(NotFoundException);
//     });

//     it('should handle tag updates when tagNames is an empty array (clearing tags)', async () => {
//       const dtoWithEmptyTags: UpdateCheeksDto = { tagNames: [] }; // Only update tags
//       (tagsServiceMock.findOrCreateTags as jest.Mock).mockResolvedValue([]); // No new tags

//       await service.updateCheeks(cheekId, dtoWithEmptyTags, ownerId);

//       expect(tagsServiceMock.findOrCreateTags).toHaveBeenCalledWith([]);
//       expect(tagsServiceMock.updateTagUsageCount).toHaveBeenCalledWith(originalTag1._id.toString(), -1); // Original tag removed
//       expect(cheeksModel.findOneAndUpdate).toHaveBeenCalledWith(
//         { _id: cheekId, owner: ownerId },
//         expect.objectContaining({ tagIds: [] }), // Tags are cleared
//         { new: true, runValidators: true },
//       );
//     });
    
//     it('should not modify tags if tagNames is undefined in DTO', async () => {
//       const dtoNoTagUpdate: UpdateCheeksDto = { title: "Only Title Update" };
//        // Reset findOrCreateTags mock for this specific test if it was set to return empty array previously
//       (tagsServiceMock.findOrCreateTags as jest.Mock).mockClear(); // Clear previous calls
//       (tagsServiceMock.updateTagUsageCount as jest.Mock).mockClear();


//       await service.updateCheeks(cheekId, dtoNoTagUpdate, ownerId);

//       expect(tagsServiceMock.findOrCreateTags).not.toHaveBeenCalled();
//       expect(tagsServiceMock.updateTagUsageCount).not.toHaveBeenCalled(); // No tag changes
//       expect(cheeksModel.findOneAndUpdate).toHaveBeenCalledWith(
//         { _id: cheekId, owner: ownerId },
//         expect.objectContaining({ title: "Only Title Update" }), // Only title updated
//         { new: true, runValidators: true },
//       );
//       // Check that tagIds was NOT part of the $set operation or was undefined in the update payload
//       const updateCallArgs = cheeksModel.findOneAndUpdate.mock.calls[0][1];
//       expect(updateCallArgs.tagIds).toBeUndefined();
//     });
//   });

//   describe('deleteCheeks', () => {
//     const cheekId = new Types.ObjectId().toHexString();
//     const ownerId = new Types.ObjectId().toHexString();
//     const tagId1 = new Types.ObjectId();
//     const cheekDocToDelete = {
//       _id: new Types.ObjectId(cheekId),
//       title: 'To Delete',
//       owner: new Types.ObjectId(ownerId),
//       tagIds: [tagId1],
//     };

//     beforeEach(() => {
//       cheeksModel.findById.mockResolvedValue(cheekDocToDelete);
//       cheeksModel.findByIdAndDelete.mockResolvedValue(cheekDocToDelete); // Simulate successful deletion
//       (tagsServiceMock.updateTagUsageCount as jest.Mock).mockResolvedValue(null);
//     });

//     it('should delete the cheek and decrement tag counts if user is the owner', async () => {
//       const result = await service.deleteCheeks(cheekId, ownerId);

//       expect(cheeksModel.findById).toHaveBeenCalledWith(cheekId);
//       expect(tagsServiceMock.updateTagUsageCount).toHaveBeenCalledWith(tagId1.toString(), -1);
//       expect(cheeksModel.findByIdAndDelete).toHaveBeenCalledWith(cheekId);
//       expect(result).toEqual({ message: 'Cheeks deleted successfully' });
//     });

//     it('should throw NotFoundException if cheek to delete is not found', async () => {
//       cheeksModel.findById.mockResolvedValue(null);
//       await expect(service.deleteCheeks(cheekId, ownerId)).rejects.toThrow(NotFoundException);
//     });

//     it('should throw ForbiddenException if user is not the owner', async () => {
//       const nonOwnerId = new Types.ObjectId().toHexString();
//       await expect(service.deleteCheeks(cheekId, nonOwnerId)).rejects.toThrow(ForbiddenException);
//       expect(tagsServiceMock.updateTagUsageCount).not.toHaveBeenCalled();
//       expect(cheeksModel.findByIdAndDelete).not.toHaveBeenCalled();
//     });
    
//     it('should handle deletion correctly if cheek has no tags', async () => {
//       const cheekWithNoTags = { ...cheekDocToDelete, tagIds: [] };
//       cheeksModel.findById.mockResolvedValue(cheekWithNoTags);

//       await service.deleteCheeks(cheekId, ownerId);
//       expect(tagsServiceMock.updateTagUsageCount).not.toHaveBeenCalled();
//       expect(cheeksModel.findByIdAndDelete).toHaveBeenCalledWith(cheekId);
//     });
//   });
// });

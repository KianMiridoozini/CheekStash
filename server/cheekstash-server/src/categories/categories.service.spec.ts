import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CategoriesService } from './categories.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Category } from './schema/category.schema';

describe('CategoriesService', () => {
    let service: CategoriesService;
    let model: any;

    const mockCategory = (overrides = {}) => ({
        _id: new Types.ObjectId(),
        name: 'Test Category',
        slug: 'test-category',
        save: jest.fn().mockResolvedValue({ ...overrides }),
        ...overrides,
    });

    // Use a jest.fn constructor for the model
    const mockCategoryModel = jest.fn();
    Object.assign(mockCategoryModel, {
        find: jest.fn(),
        findById: jest.fn(),
        findOne: jest.fn(),
        findByIdAndDelete: jest.fn(),
        create: jest.fn(),
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CategoriesService,
                { provide: getModelToken(Category.name), useValue: mockCategoryModel },
            ],
        }).compile();
        service = module.get<CategoriesService>(CategoriesService);
        model = module.get(getModelToken(Category.name));
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create and return a category', async () => {
            const dto = { name: 'Test', slug: 'test' };
            // Mock the constructor to return an object with save
            model.mockImplementationOnce(() => ({ ...dto, save: jest.fn().mockResolvedValue(dto) }));
            const result = await service.create(dto as any);
            expect(result).toEqual(dto);
        });
        it('should throw ConflictException on duplicate', async () => {
            const dto = { name: 'Test', slug: 'test' };
            const error = { code: 11000 };
            model.mockImplementationOnce(() => ({ save: jest.fn().mockRejectedValue(error) }));
            await expect(service.create(dto as any)).rejects.toThrow(ConflictException);
        });
    });

    describe('findAll', () => {
        it('should return all categories', async () => {
            const cats = [mockCategory()];
            model.find.mockReturnValue({ exec: jest.fn().mockResolvedValue(cats) });
            const result = await service.findAll();
            expect(result).toEqual(cats);
        });
    });

    describe('findOne', () => {
        it('should return a category by id', async () => {
            const cat = mockCategory();
            model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(cat) });
            const result = await service.findOne(cat._id.toString());
            expect(result).toEqual(cat);
        });
        it('should throw NotFoundException if not found', async () => {
            model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            await expect(service.findOne('badid')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findOneBySlug', () => {
        it('should return a category by slug', async () => {
            const cat = mockCategory();
            model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(cat) });
            const result = await service.findOneBySlug(cat.slug);
            expect(result).toEqual(cat);
        });
        it('should throw NotFoundException if not found', async () => {
            model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            await expect(service.findOneBySlug('bad-slug')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findByNameRegex', () => {
        it('should return categories matching regex', async () => {
            const cats = [mockCategory()];
            model.find.mockReturnValue({ exec: jest.fn().mockResolvedValue(cats) });
            const result = await service.findByNameRegex(/Test/);
            expect(result).toEqual(cats);
        });
    });

    describe('update', () => {
        it('should update and return the category', async () => {
            const id = new Types.ObjectId().toString();
            const cat = mockCategory({ _id: id, name: 'Old' });
            const updated = { ...cat, name: 'New' };
            model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(cat) });
            model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            cat.save = jest.fn().mockResolvedValue(updated);
            const result = await service.update(id, { name: 'New' });
            expect(result).toEqual(updated);
        });
        it('should throw NotFoundException if not found', async () => {
            model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            await expect(service.update('badid', { name: 'New' })).rejects.toThrow(NotFoundException);
        });
        it('should throw ConflictException if name exists', async () => {
            const id = new Types.ObjectId().toString();
            const cat = mockCategory({ _id: id, name: 'Old' });
            const otherCat = mockCategory({ _id: new Types.ObjectId(), name: 'New' });
            model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(cat) });
            model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(otherCat) });
            await expect(service.update(id, { name: 'New' })).rejects.toThrow(ConflictException);
        });
    });

    describe('remove', () => {
        it('should delete and return message', async () => {
            const id = new Types.ObjectId().toString();
            const cat = mockCategory({ _id: id });
            model.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(cat) });
            const result = await service.remove(id);
            expect(result).toEqual({ message: 'Category deleted successfully' });
        });
        it('should throw NotFoundException if not found', async () => {
            model.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            await expect(service.remove('badid')).rejects.toThrow(NotFoundException);
        });
    });
});

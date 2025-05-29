import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('CategoriesController', () => {
    let controller: CategoriesController;
    let service: CategoriesService;

    const mockCategory = { _id: '1', name: 'Test', slug: 'test' };

    const mockCategoriesService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        findOneBySlug: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [CategoriesController],
            providers: [
                { provide: CategoriesService, useValue: mockCategoriesService },
            ],
        }).compile();
        controller = module.get<CategoriesController>(CategoriesController);
        service = module.get<CategoriesService>(CategoriesService);
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should call service.create and return result', async () => {
            const dto: CreateCategoryDto = { name: 'Test', slug: 'test' } as any;
            mockCategoriesService.create.mockResolvedValue(mockCategory);
            const result = await controller.create(dto);
            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockCategory);
        });
    });

    describe('findAll', () => {
        it('should return all categories', async () => {
            mockCategoriesService.findAll.mockResolvedValue([mockCategory]);
            const result = await controller.findAll();
            expect(service.findAll).toHaveBeenCalled();
            expect(result).toEqual([mockCategory]);
        });
    });

    describe('findOne', () => {
        it('should return a category by id', async () => {
            mockCategoriesService.findOne.mockResolvedValue(mockCategory);
            const result = await controller.findOne('1');
            expect(service.findOne).toHaveBeenCalledWith('1');
            expect(result).toEqual(mockCategory);
        });
    });

    describe('findOneBySlug', () => {
        it('should return a category by slug', async () => {
            mockCategoriesService.findOneBySlug.mockResolvedValue(mockCategory);
            const result = await controller.findOneBySlug('test');
            expect(service.findOneBySlug).toHaveBeenCalledWith('test');
            expect(result).toEqual(mockCategory);
        });
    });

    describe('update', () => {
        it('should call service.update and return result', async () => {
            const dto: UpdateCategoryDto = { name: 'Updated' } as any;
            mockCategoriesService.update.mockResolvedValue({ ...mockCategory, ...dto });
            const result = await controller.update('1', dto);
            expect(service.update).toHaveBeenCalledWith('1', dto);
            expect(result).toEqual({ ...mockCategory, ...dto });
        });
    });

    describe('remove', () => {
        it('should call service.remove and return void', async () => {
            mockCategoriesService.remove.mockResolvedValue({ message: 'Category deleted successfully' });
            await expect(controller.remove('1')).resolves.toBeUndefined();
            expect(service.remove).toHaveBeenCalledWith('1');
        });
    });
});

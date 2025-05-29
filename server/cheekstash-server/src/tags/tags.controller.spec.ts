import { Test, TestingModule } from '@nestjs/testing';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { NotFoundException } from '@nestjs/common';
import { CreateTagDto } from './dto/create-tag.dto';

describe('TagsController', () => {
    let controller: TagsController;
    let service: TagsService;

    const mockTag = { _id: '1', name: 'test', usageCount: 0 };

    const mockTagsService = {
        create: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
        findOneByName: jest.fn(),
        remove: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TagsController],
            providers: [
                { provide: TagsService, useValue: mockTagsService },
            ],
        }).compile();
        controller = module.get<TagsController>(TagsController);
        service = module.get<TagsService>(TagsService);
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should call service.create and return result', async () => {
            const dto: CreateTagDto = { name: 'test' };
            mockTagsService.create.mockResolvedValue(mockTag);
            const result = await controller.create(dto);
            expect(service.create).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockTag);
        });
    });

    describe('findAll', () => {
        it('should return all tags', async () => {
            mockTagsService.findAll.mockResolvedValue([mockTag]);
            const result = await controller.findAll();
            expect(service.findAll).toHaveBeenCalled();
            expect(result).toEqual([mockTag]);
        });
    });

    describe('findOneByName', () => {
        it('should return a tag by name', async () => {
            mockTagsService.findOneByName.mockResolvedValue(mockTag);
            const result = await controller.findOneByName('test');
            expect(service.findOneByName).toHaveBeenCalledWith('test');
            expect(result).toEqual(mockTag);
        });
        it('should throw NotFoundException if not found', async () => {
            mockTagsService.findOneByName.mockResolvedValue(null);
            await expect(controller.findOneByName('notfound')).rejects.toThrow(NotFoundException);
        });
    });

    describe('findOne', () => {
        it('should return a tag by id', async () => {
            mockTagsService.findOne.mockResolvedValue(mockTag);
            const result = await controller.findOne('1');
            expect(service.findOne).toHaveBeenCalledWith('1');
            expect(result).toEqual(mockTag);
        });
    });

    describe('remove', () => {
        it('should call service.remove and return void', async () => {
            mockTagsService.remove.mockResolvedValue({ message: 'Tag deleted successfully' });
            await expect(controller.remove('1')).resolves.toBeUndefined();
            expect(service.remove).toHaveBeenCalledWith('1');
        });
    });
});

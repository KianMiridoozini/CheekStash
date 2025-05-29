import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TagsService } from './tags.service';
import { ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Tag } from './schema/tag.schema';

describe('TagsService', () => {
    let service: TagsService;
    let model: any;

    const mockTag = (overrides = {}) => ({
        _id: new Types.ObjectId(),
        name: 'test',
        usageCount: 0,
        save: jest.fn().mockResolvedValue({ ...overrides }),
        ...overrides,
    });

    const mockTagModel = jest.fn();
    Object.assign(mockTagModel, {
        find: jest.fn(),
        findById: jest.fn(),
        findOne: jest.fn(),
        findByIdAndDelete: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        create: jest.fn(),
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TagsService,
                { provide: getModelToken(Tag.name), useValue: mockTagModel },
            ],
        }).compile();
        service = module.get<TagsService>(TagsService);
        model = module.get(getModelToken(Tag.name));
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create and return a tag', async () => {
            const dto = { name: 'Test' };
            model.mockImplementationOnce(() => ({ ...dto, save: jest.fn().mockResolvedValue({ ...dto, name: 'test' }) }));
            const result = await service.create(dto as any);
            expect(result).toEqual({ ...dto, name: 'test' });
        });
        it('should throw ConflictException on duplicate', async () => {
            const dto = { name: 'Test' };
            const error = { code: 11000 };
            model.mockImplementationOnce(() => ({ save: jest.fn().mockRejectedValue(error) }));
            await expect(service.create(dto as any)).rejects.toThrow(ConflictException);
        });
        it('should throw InternalServerErrorException on other errors', async () => {
            const dto = { name: 'Test' };
            const error = { code: 123 };
            model.mockImplementationOnce(() => ({ save: jest.fn().mockRejectedValue(error) }));
            await expect(service.create(dto as any)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('findAll', () => {
        it('should return all tags sorted', async () => {
            const tags = [mockTag()];
            model.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(tags) });
            const result = await service.findAll();
            expect(result).toEqual(tags);
        });
    });

    describe('findOne', () => {
        it('should return a tag by id', async () => {
            const tag = mockTag();
            model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(tag) });
            const result = await service.findOne(tag._id.toString());
            expect(result).toEqual(tag);
        });
        it('should throw NotFoundException for invalid id', async () => {
            await expect(service.findOne('badid')).rejects.toThrow(NotFoundException);
        });
        it('should throw NotFoundException if not found', async () => {
            model.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            await expect(service.findOne(new Types.ObjectId().toString())).rejects.toThrow(NotFoundException);
        });
    });

    describe('findOneByName', () => {
        it('should return a tag by name', async () => {
            const tag = mockTag();
            model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(tag) });
            const result = await service.findOneByName('test');
            expect(result).toEqual(tag);
        });
        it('should return null if not found', async () => {
            model.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            const result = await service.findOneByName('notfound');
            expect(result).toBeNull();
        });
    });

    describe('findByNameRegex', () => {
        it('should return tags matching regex', async () => {
            const tags = [mockTag()];
            model.find.mockReturnValue({ exec: jest.fn().mockResolvedValue(tags) });
            const result = await service.findByNameRegex(/test/);
            expect(result).toEqual(tags);
        });
    });

    describe('findByIds', () => {
        it('should return tags by ids', async () => {
            const tags = [mockTag()];
            model.find.mockReturnValue({ exec: jest.fn().mockResolvedValue(tags) });
            const ids = [tags[0]._id.toString()];
            const result = await service.findByIds(ids);
            expect(result).toEqual(tags);
        });
    });

    describe('findOrCreateTags', () => {
        it('should find or create tags', async () => {
            const tag = mockTag({ name: 'test' });
            jest.spyOn(service, 'findOneByName').mockResolvedValueOnce(null).mockResolvedValueOnce(tag as any);
            jest.spyOn(service, 'create').mockResolvedValueOnce(tag as any);
            const result = await service.findOrCreateTags(['test']);
            expect(result).toEqual([tag]);
        });
        it('should handle conflict and find after conflict', async () => {
            const tag = mockTag({ name: 'test' });
            jest.spyOn(service, 'findOneByName').mockResolvedValueOnce(null).mockResolvedValueOnce(tag as any);
            jest.spyOn(service, 'create').mockRejectedValueOnce(new ConflictException());
            const result = await service.findOrCreateTags(['test']);
            expect(result).toEqual([tag]);
        });
        it('should throw InternalServerErrorException if cannot find after conflict', async () => {
            jest.spyOn(service, 'findOneByName').mockResolvedValueOnce(null).mockResolvedValueOnce(null);
            jest.spyOn(service, 'create').mockRejectedValueOnce(new ConflictException());
            await expect(service.findOrCreateTags(['test'])).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('updateTagUsageCount', () => {
        it('should update usage count and return tag', async () => {
            const tag = mockTag();
            model.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(tag) });
            const result = await service.updateTagUsageCount(tag._id.toString(), 1);
            expect(result).toEqual(tag);
        });
        it('should return null for invalid id', async () => {
            const result = await service.updateTagUsageCount('badid', 1);
            expect(result).toBeNull();
        });
    });

    describe('remove', () => {
        it('should delete and return message', async () => {
            const tag = mockTag();
            jest.spyOn(service, 'findOne').mockResolvedValueOnce(tag as any);
            model.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(tag) });
            const result = await service.remove(tag._id.toString());
            expect(result).toEqual({ message: `Tag "${tag.name}" deleted successfully` });
        });
        it('should throw NotFoundException for invalid id', async () => {
            await expect(service.remove('badid')).rejects.toThrow(NotFoundException);
        });
        it('should throw NotFoundException if not found', async () => {
            const tag = mockTag();
            jest.spyOn(service, 'findOne').mockResolvedValueOnce(tag as any);
            model.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
            await expect(service.remove(tag._id.toString())).rejects.toThrow(NotFoundException);
        });
    });
});

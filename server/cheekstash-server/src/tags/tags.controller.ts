import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    UseGuards,
    Query,
    HttpCode,
    HttpStatus,
    NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Tag } from './schema/tag.schema';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
    constructor(private readonly tagsService: TagsService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new tag (Admin only)' })
    @ApiResponse({ status: 201, description: 'Tag created successfully.', type: Tag })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden resource.' })
    @ApiResponse({ status: 409, description: 'Tag name already exists.' })
    create(@Body() createTagDto: CreateTagDto) {
        return this.tagsService.create(createTagDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all tags, sorted by usage count (desc) and name (asc)' })
    @ApiResponse({ status: 200, description: 'List of all tags.', type: [Tag] })
    findAll() {
        return this.tagsService.findAll();
    }

    @Get('find-by-name')
    @ApiOperation({ summary: 'Find a tag by its name' })
    @ApiQuery({ name: 'name', description: 'Tag name to search for', type: String, required: true })
    @ApiResponse({ status: 200, description: 'The found tag.', type: Tag })
    @ApiResponse({ status: 404, description: 'Tag not found.' })
    async findOneByName(@Query('name') name: string) {
        const tag = await this.tagsService.findOneByName(name);
        if (!tag) {
            throw new NotFoundException(`Tag with name "${name}" not found`);
        }
        return tag;
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a tag by ID' })
    @ApiParam({ name: 'id', description: 'Tag ID', type: String })
    @ApiResponse({ status: 200, description: 'The found tag.', type: Tag })
    @ApiResponse({ status: 404, description: 'Tag not found.' })
    findOne(@Param('id') id: string) {
        return this.tagsService.findOne(id);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a tag (Admin only)' })
    @ApiParam({ name: 'id', description: 'Tag ID to delete', type: String })
    @ApiResponse({ status: 204, description: 'Tag deleted successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden resource.' })
    @ApiResponse({ status: 404, description: 'Tag not found.' })
    // @ApiResponse({ status: 409, description: 'Tag is still in use and cannot be deleted.' }) // If usage check is added
    async remove(@Param('id') id: string): Promise<void> {
        await this.tagsService.remove(id);
    }
}

import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Assuming you have JWT Auth
import { RolesGuard } from '../auth/roles.guard'; // Assuming you will create/have a RolesGuard
import { Roles } from '../auth/roles.decorator'; // Assuming you will create/have a Roles decorator
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Category } from './schema/category.schema';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard) 
    @Roles('admin')
    @ApiOperation({ summary: 'Create a new category (Admin only)' })
    @ApiResponse({ status: 201, description: 'Category created successfully.', type: Category })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden resource.' })
    @ApiResponse({ status: 409, description: 'Category name already exists.' })
    create(@Body() createCategoryDto: CreateCategoryDto) {
        return this.categoriesService.create(createCategoryDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all categories' })
    @ApiResponse({ status: 200, description: 'List of all categories.', type: [Category] })
    findAll() {
        return this.categoriesService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a category by ID' })
    @ApiParam({ name: 'id', description: 'Category ID', type: String })
    @ApiResponse({ status: 200, description: 'The found category.', type: Category })
    @ApiResponse({ status: 404, description: 'Category not found.' })
    findOne(@Param('id') id: string) {
        return this.categoriesService.findOne(id);
    }

    @Get('slug/:slug')
    @ApiOperation({ summary: 'Get a category by slug' })
    @ApiParam({ name: 'slug', description: 'Category slug', type: String })
    @ApiResponse({ status: 200, description: 'The found category.', type: Category })
    @ApiResponse({ status: 404, description: 'Category not found.' })
    findOneBySlug(@Param('slug') slug: string) {
        return this.categoriesService.findOneBySlug(slug);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin') // Only admin can update
    @ApiOperation({ summary: 'Update a category (Admin only)' })
    @ApiParam({ name: 'id', description: 'Category ID to update', type: String })
    @ApiResponse({ status: 200, description: 'Category updated successfully.', type: Category })
    @ApiResponse({ status: 400, description: 'Invalid input.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden resource.' })
    @ApiResponse({ status: 404, description: 'Category not found.' })
    @ApiResponse({ status: 409, description: 'Category name already exists.' })
    update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
        return this.categoriesService.update(id, updateCategoryDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @HttpCode(HttpStatus.NO_CONTENT) 
    @ApiOperation({ summary: 'Delete a category (Admin only)' })
    @ApiParam({ name: 'id', description: 'Category ID to delete', type: String })
    @ApiResponse({ status: 204, description: 'Category deleted successfully.' })
    @ApiResponse({ status: 401, description: 'Unauthorized.' })
    @ApiResponse({ status: 403, description: 'Forbidden resource.' })
    @ApiResponse({ status: 404, description: 'Category not found.' })
    async remove(@Param('id') id: string): Promise<void> {
        await this.categoriesService.remove(id);
    }
}

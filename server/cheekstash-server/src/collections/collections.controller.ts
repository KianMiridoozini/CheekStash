import { Controller, Post, Body, Get, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CollectionDto } from './dto/collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  /**
   * Create a new collection (Protected: Requires authentication)
   */
  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new collection' })
  async create(@Body() collectionDto: CollectionDto, @Req() req) {
    return this.collectionsService.createCollection(collectionDto, req.user.id);
  }

  /**
   * Get all collections
   */
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all collections' })
  async findAll() {
    return this.collectionsService.getCollections();
  }

  /**
   * Get a collection by ID 
   */
  @Get(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get a collection by ID' })
  async findOne(@Param('id') id: string) {
    return this.collectionsService.getCollectionById(id);
  }

  /**
   * Update a collection (Protected: Only the collection owner)
   */
  @Put(':id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a collection' })
  async update(
    @Param('id') id: string, 
    @Body() updateDto: UpdateCollectionDto, 
    @Req() req
  ) {
    return this.collectionsService.updateCollection(id, updateDto, req.user.id);
  }
  
  /**
   * Delete a collection (Protected: Only the collection owner)
   */
  @Delete(':id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a collection' })
  async remove(@Param('id') id: string, @Req() req) {
    return this.collectionsService.deleteCollection(id, req.user.id);
  }
}

import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('collections')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard) // Protect this endpoint
  @ApiOperation({ summary: 'Create a new collection (requires authentication)' })
  async create(@Body() createCollectionDto: CreateCollectionDto, @Req() req) {
    return this.collectionsService.create(createCollectionDto, req.user.id);
  }
}

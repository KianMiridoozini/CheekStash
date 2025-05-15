import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  UseGuards,
  Req,
  BadRequestException,
  Patch,
  SetMetadata,
  Query,
} from '@nestjs/common';
import { CheeksService } from './cheeks.service';
import { CheeksDto } from './dto/cheeks.dto';
import { UpdateCheeksDto } from './dto/update-cheeks.dto';
import { HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheekVisibilityGuard } from '../common/guards/cheek-visibility.guard';
import { Public } from '../auth/public.decorator';
import { UpdateCheekVisibilityDto } from './dto/update-cheek-visibility.dto';
import { QueryCheeksDto } from './dto/query-cheeks.dto';

@ApiTags('cheeks')
@Controller('cheeks')
export class CheeksController {
  constructor(private readonly cheeksService: CheeksService) {}

  /**
   * Create a new cheek (Protected: Requires authentication)
   */
  @Post()
  @HttpCode(201)
  @ApiResponse({ status: 201, description: 'Cheek created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new cheek' })
  async create(@Body() cheeksDto: CheeksDto, @Req() req) {
    return this.cheeksService.createCheeks(cheeksDto, req.user.id);
  }

  /**
   * Get all cheeks (paginated, filterable, sortable)
   */
  @Get()
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all cheeks with pagination, filtering, and sorting' })
  @ApiResponse({ status: 200, description: 'Cheeks retrieved successfully.' })
  async findAll(@Query() queryDto: QueryCheeksDto, @Req() req) {
    const requestingUserId = req.user?.id;
    return this.cheeksService.getCheeksPaginated(queryDto, requestingUserId);
  }

  /**
   * Get cheek suggestions for search
   */
  @Get('suggestions')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get cheek suggestions for search typeahead' })
  @ApiResponse({ status: 200, description: 'Cheek suggestions retrieved successfully.' })
  async getSuggestions(@Query() queryDto: QueryCheeksDto, @Req() req) {
    const requestingUserId = req.user?.id;
    return this.cheeksService.getCheekSuggestions(queryDto, requestingUserId);
  }

  /**
   * Get all cheeks by a specific user ID
   */
  @Get('user/:userId')
  @Public()
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Cheeks for user found' })
  @ApiResponse({ status: 404, description: 'User not found or no cheeks found for user' })
  @ApiOperation({ summary: 'Get all cheeks by user ID' })
  async findCheeksByUserId(@Param('userId') userId: string, @Req() req) {
    const requestingUserId = req.user ? req.user.id : undefined;
    return this.cheeksService.getCheeksByUserId(userId, requestingUserId);
  }

  /**
   * Get a cheek by combined username+slug format
   */
  @Get('by/:usernamePlusSlug') 
  @UseGuards(JwtAuthGuard, CheekVisibilityGuard)
  @ApiBearerAuth()
  @SetMetadata('isPublicRoute', false)
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Cheek found' })
  @ApiResponse({ status: 404, description: 'Cheek not found' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiOperation({ summary: 'Get a cheek by username+slug format' })
  async findByUsernamePlusSlug(@Param('usernamePlusSlug') usernamePlusSlug: string, @Req() req) {
    if (!usernamePlusSlug || !usernamePlusSlug.includes('+')) {
      throw new BadRequestException('Invalid format: Must provide username+slug');
    }
    
    const [username, cheekSlug] = usernamePlusSlug.split('+', 2);
    if (!username || !cheekSlug) {
      throw new BadRequestException('Username and cheek slug must be provided in format username+slug');
    }
    
    const requestingUserId = req.user ? req.user.id : undefined;
    return this.cheeksService.findCheekByUsernameAndSlug(username, cheekSlug, requestingUserId);
  }
  
  /**
   * Get a cheek by sanitized username and cheek slug
   */
  @Get('by/:username/:cheekSlug')
  @UseGuards(JwtAuthGuard, CheekVisibilityGuard)
  @ApiBearerAuth()
  @SetMetadata('isPublicRoute', false)
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Cheek found' })
  @ApiResponse({ status: 404, description: 'Cheek not found' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  @ApiOperation({ summary: 'Get a cheek by username and cheek slug' })
  async findByUsernameAndSlug(
    @Param('username') username: string,
    @Param('cheekSlug') cheekSlug: string,
    @Req() req,
  ) {
    if (!username || !cheekSlug) {
      throw new BadRequestException('Username and cheek slug must be provided.');
    }
    const requestingUserId = req.user ? req.user.id : undefined;
    return this.cheeksService.findCheekByUsernameAndSlug(username, cheekSlug, requestingUserId);
  }

  /**
   * Get a cheek by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, CheekVisibilityGuard)
  @ApiBearerAuth()
  @SetMetadata('isPublicRoute', false)
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Cheek found' })
  @ApiResponse({ status: 404, description: 'Cheek not found' })
  @ApiOperation({ summary: 'Get a cheek by ID' })
  async findOne(@Param('id') id: string, @Req() req) {
    const requestingUserId = req.user ? req.user.id : undefined;
    return this.cheeksService.getCheeksById(id, requestingUserId);
  }

  /**
   * Update a cheek (Protected: Only the cheek owner)
   */
  @Patch(':id')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Cheek updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a cheek' })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCheeksDto,
    @Req() req,
  ) {
    return this.cheeksService.updateCheeks(id, updateDto, req.user.id);
  }

  /**
   * Update a cheek's visibility (Protected: Only the cheek owner)
   */
  @Patch(':id/visibility')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Cheek visibility updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Cheek not found' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update a cheek's visibility" })
  async updateVisibility(
    @Param('id') cheekId: string,
    @Body() updateVisibilityDto: UpdateCheekVisibilityDto,
    @Req() req,
  ) {
    return this.cheeksService.updateCheekVisibility(cheekId, updateVisibilityDto, req.user.id);
  }

  /**
   * Delete a cheek (Protected: Only the cheek owner)
   */
  @Delete(':id')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Cheek deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a cheek' })
  async remove(@Param('id') id: string, @Req() req) {
    return this.cheeksService.deleteCheeks(id, req.user.id);
  }
}

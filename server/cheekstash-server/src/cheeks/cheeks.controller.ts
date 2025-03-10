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
   * Get all cheeks
   */
  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all cheeks' })
  async findAll() {
    return this.cheeksService.getCheeks();
  }

  /**
   * Get a cheek by ID
   */
  @Get(':id')
  @HttpCode(200)
  @ApiResponse({ status: 200, description: 'Cheek found' })
  @ApiResponse({ status: 404, description: 'Cheek not found' })
  @ApiOperation({ summary: 'Get a cheek by ID' })
  async findOne(@Param('id') id: string) {
    return this.cheeksService.getCheeksById(id);
  }

  /**
   * Update a cheek (Protected: Only the cheek owner)
   */
  @Put(':id')
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

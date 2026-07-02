import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserAddress } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('Addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List saved addresses for current user' })
  @ApiOkResponse()
  findAll(@CurrentUser('id') userId: string): Promise<UserAddress[]> {
    return this.addressesService.findAll(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new address for current user' })
  @ApiCreatedResponse()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAddressDto,
  ): Promise<UserAddress> {
    return this.addressesService.create(userId, dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an address (must be owned by current user)',
  })
  @ApiOkResponse()
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<UserAddress> {
    return this.addressesService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an address (must be owned by current user)',
  })
  @ApiNoContentResponse()
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.addressesService.remove(id, userId);
  }
}

import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request } from '@nestjs/common';
import { CardsService } from './cards.service';
import {
  CreateCardDto,
  CardsQueryDto,
  UpdateCardDto,
  BulkDeleteCardDto,
  CardActionDto,
} from './dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Cards')
@ApiBearerAuth('JWT-auth')
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new card',
    description: 'Creates a new card record with the provided details.',
  })
  create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createCardDto: CreateCardDto,
  ) {
    return this.cardsService.create(createCardDto, createdBy);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all cards',
    description: 'Retrieves a list of all cards with optional filtering and statistics.',
  })
  findAll(@Query() query: CardsQueryDto) {
    return this.cardsService.findAllWithStats(query);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a card',
    description: 'Updates an existing card with the provided information.',
  })
  update(
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    return this.cardsService.update({ id }, { ...updateCardDto, updatedBy });
  }

  @Post('action')
  @ApiOperation({
    summary: 'Perform card action',
    description: 'Executes a specific action on a card (e.g., activate, deactivate, renew).',
  })
  @ApiBody({ type: CardActionDto })
  action(
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() actionDto: CardActionDto,
  ) {
    return this.cardsService.action(actionDto, updatedBy);
  }

  @Delete('bulk')
  @ApiOperation({
    summary: 'Bulk delete cards',
    description: 'Deletes multiple cards at once based on the provided card IDs.',
  })
  @ApiBody({ type: BulkDeleteCardDto })
  bulkDeleteCards(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Body() bulkDeleteDto: BulkDeleteCardDto,
  ) {
    return this.cardsService.bulkDeleteCards({
      ...bulkDeleteDto,
      deletedBy,
    });
  }
}

import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request } from '@nestjs/common';
import { CardsService } from './cards.service';
import {
  CreateCardDto,
  CardsQueryDto,
  UpdateCardDto,
  BulkDeleteCardDto,
  CardActionDto,
} from './dto';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';

@ApiTags('Cards')
@ApiBearerAuth('JWT-auth')
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  create(
    @Request() { user: { id: createdBy } }: { user: { id: string } },
    @Body() createCardDto: CreateCardDto,
  ) {
    return this.cardsService.create(createCardDto, createdBy);
  }

  @Get()
  findAll(@Query() query: CardsQueryDto) {
    return this.cardsService.findAllWithStats(query);
  }

  @Patch(':id')
  update(
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    return this.cardsService.update({ id }, { ...updateCardDto, updatedBy });
  }

  @Post('action')
  @ApiBody({ type: CardActionDto })
  action(
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Body() actionDto: CardActionDto,
  ) {
    return this.cardsService.action(actionDto, updatedBy);
  }

  @Delete('bulk')
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

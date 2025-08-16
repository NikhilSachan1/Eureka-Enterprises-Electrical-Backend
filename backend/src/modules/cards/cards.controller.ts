import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Request } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDto, CardsQueryDto, UpdateCardDto } from './dto';

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
    return this.cardsService.findAll({ where: { ...query } });
  }

  @Patch(':id')
  update(
    @Request() { user: { id: updatedBy } }: { user: { id: string } },
    @Param('id') id: string,
    @Body() updateCardDto: UpdateCardDto,
  ) {
    return this.cardsService.update({ id }, { ...updateCardDto, updatedBy });
  }

  @Delete(':id')
  delete(
    @Request() { user: { id: deletedBy } }: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.cardsService.delete({ id }, deletedBy);
  }
}

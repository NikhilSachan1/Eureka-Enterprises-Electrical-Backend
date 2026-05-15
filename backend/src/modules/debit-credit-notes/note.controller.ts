import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NoteService } from './note.service';
import { CreateNoteDto, UpdateNoteDto, GetNoteDto } from './dto';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { RequiredPermission } from 'src/modules/auth/decorators/required-permission.decorator';
import { NoteSide } from 'src/modules/common/financials/financial.constants';

@ApiTags('Debit/Credit Notes')
@ApiBearerAuth('JWT-auth')
@Controller('notes')
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Post()
  @RequiredPermission('financials.notes.create')
  @ApiOperation({
    summary: 'Create a note (SALE: debit note, PURCHASE: credit note)',
  })
  create(@Body() dto: CreateNoteDto, @GetUser('id') userId: string) {
    return this.noteService.create(dto, userId);
  }

  @Get()
  @RequiredPermission('financials.notes.view')
  @ApiOperation({
    summary: 'List notes by side (SALE: debit notes, PURCHASE: credit notes)',
  })
  findAll(@Query() query: GetNoteDto) {
    return this.noteService.findAll(query);
  }

  @Get(':id')
  @RequiredPermission('financials.notes.view')
  @ApiOperation({ summary: 'Get a single note by ID and side' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query('noteSide') noteSide: NoteSide) {
    return this.noteService.findById(id, noteSide);
  }

  @Patch(':id')
  @RequiredPermission('financials.notes.update')
  @ApiOperation({ summary: 'Update a note' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('noteSide') noteSide: NoteSide,
    @Body() dto: UpdateNoteDto,
    @GetUser('id') userId: string,
  ) {
    return this.noteService.update(id, noteSide, dto, userId);
  }

  @Delete(':id')
  @RequiredPermission('financials.notes.delete')
  @ApiOperation({ summary: 'Delete a note' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('noteSide') noteSide: NoteSide,
    @GetUser('id') userId: string,
  ) {
    return this.noteService.remove(id, noteSide, userId);
  }
}

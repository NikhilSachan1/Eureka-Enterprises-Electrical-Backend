import { PartialType } from '@nestjs/swagger';
import { CreateSiteDocumentDto } from './create-site-document.dto';

export class UpdateSiteDocumentDto extends PartialType(CreateSiteDocumentDto) {}

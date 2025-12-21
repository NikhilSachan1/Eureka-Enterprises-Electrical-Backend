import { PartialType } from '@nestjs/mapped-types';
import { CreateAssetVersionDto } from './create-asset.dto';

export class UpdateAssetVersionDto extends PartialType(CreateAssetVersionDto) {}

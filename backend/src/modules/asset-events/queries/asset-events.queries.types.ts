import { AssetEventsQueryDto } from '../dto/asset-events-query.dto';

export interface BuildAssetEventsQueryParams {
  assetMasterId: string;
  query: AssetEventsQueryDto;
  startDateUTC?: Date;
  endDateUTC?: Date;
}

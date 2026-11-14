import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/** Query for the P&L summary of several projects at once (project list). */
export class GetSitesProfitabilitySummaryDto {
  /** One or more site IDs. Accepts ?siteId[]=uuid1&siteId[]=uuid2 */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  siteId: string[];
}

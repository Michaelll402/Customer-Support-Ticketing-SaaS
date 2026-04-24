import { ApiProperty } from '@nestjs/swagger';

import { SortOrder, TicketListSortBy } from './ticket-list-query.dto';
import { TicketListItemDto } from './ticket-list-item.dto';

class TicketListMetaDto {
  @ApiProperty({
    example: 1,
  })
  page!: number;

  @ApiProperty({
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    example: 24,
  })
  totalItems!: number;

  @ApiProperty({
    example: 3,
  })
  totalPages!: number;

  @ApiProperty({
    example: true,
  })
  hasNextPage!: boolean;

  @ApiProperty({
    example: false,
  })
  hasPreviousPage!: boolean;

  @ApiProperty({
    enum: TicketListSortBy,
    example: TicketListSortBy.CREATED_AT,
  })
  sortBy!: TicketListSortBy;

  @ApiProperty({
    enum: SortOrder,
    example: SortOrder.DESC,
  })
  sortOrder!: SortOrder;
}

export class TicketListResponseDto {
  @ApiProperty({
    type: [TicketListItemDto],
  })
  items!: TicketListItemDto[];

  @ApiProperty({
    type: TicketListMetaDto,
  })
  meta!: TicketListMetaDto;
}

export interface EntryDto {
  id: string;
  name: string;
  classId: string;
  cardNumber: string;
  club?: string;
  createdAt: string;
}

export type EntrySummaryDto = Pick<EntryDto, 'id' | 'name' | 'classId' | 'cardNumber' | 'club'>;

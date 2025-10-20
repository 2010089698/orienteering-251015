import type { StartlistSnapshot, StartlistVersionDto } from '@startlist-management/domain';
import type { StartlistDiffChanges } from './StartlistDiff.js';

export interface StartlistVersionSummaryDto {
  version: number;
  confirmedAt: string;
}

export interface StartlistDiffDto {
  startlistId: string;
  to: StartlistVersionSummaryDto;
  from?: StartlistVersionSummaryDto;
  changes: StartlistDiffChanges;
}

export type StartlistWithHistoryDto = StartlistSnapshot & {
  versions?: StartlistVersionSummaryDto[];
  diff?: StartlistDiffDto;
};

export interface GetStartlistQuery {
  startlistId: string;
  includeVersions?: boolean;
  versionLimit?: number;
  includeDiff?: boolean;
  diffFromVersion?: number;
  diffToVersion?: number;
}

export interface GetStartlistVersionsQuery {
  startlistId: string;
  limit?: number;
  offset?: number;
}

export interface GetStartlistVersionsResult {
  startlistId: string;
  total: number;
  items: StartlistVersionDto[];
}

export interface GetStartlistDiffQuery {
  startlistId: string;
  fromVersion?: number;
  toVersion?: number;
}

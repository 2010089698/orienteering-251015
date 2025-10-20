import { StartlistId, StartlistSnapshot, StartlistVersion, StartlistVersionRepository, toStartlistVersionDto } from '@startlist-management/domain';
import { StartlistNotFoundError, StartlistVersionNotFoundError } from '../errors.js';
import { StartlistReadRepository } from './StartlistReadRepository.js';
import {
  GetStartlistDiffQuery,
  GetStartlistQuery,
  GetStartlistVersionsQuery,
  GetStartlistVersionsResult,
  StartlistDiffDto,
  StartlistVersionSummaryDto,
  StartlistWithHistoryDto,
} from './StartlistQueryTypes.js';
import { diffStartlistSnapshots } from './StartlistDiff.js';

export interface StartlistQueryService {
  execute(query: GetStartlistQuery): Promise<StartlistWithHistoryDto>;
  listVersions(query: GetStartlistVersionsQuery): Promise<GetStartlistVersionsResult>;
  diff(query: GetStartlistDiffQuery): Promise<StartlistDiffDto | undefined>;
}

const toSummaryDto = (version: StartlistVersion): StartlistVersionSummaryDto => ({
  version: version.version,
  confirmedAt: version.confirmedAt.toISOString(),
});

const sortVersionsDesc = (versions: StartlistVersion[]): StartlistVersion[] =>
  [...versions].sort((left, right) => right.version - left.version);

export class StartlistQueryServiceImpl implements StartlistQueryService {
  constructor(
    private readonly repository: StartlistReadRepository,
    private readonly versionRepository: StartlistVersionRepository,
  ) {}

  async execute(query: GetStartlistQuery): Promise<StartlistWithHistoryDto> {
    const startlistId = StartlistId.create(query.startlistId);
    const snapshot = await this.repository.findById(startlistId);
    if (!snapshot) {
      throw new StartlistNotFoundError(startlistId.toString());
    }

    const includeVersions = query.includeVersions ?? false;
    const includeDiff = query.includeDiff ?? false;

    if (!includeVersions && !includeDiff) {
      return snapshot;
    }

    const versions = sortVersionsDesc(await this.versionRepository.findVersions(startlistId));

    const versionLimit = query.versionLimit ?? 2;
    const limitedSummaries = includeVersions
      ? versions.slice(0, Math.max(1, versionLimit)).map(toSummaryDto)
      : undefined;

    const diff = includeDiff
      ? this.buildDiffDto(startlistId, versions, query.diffFromVersion, query.diffToVersion)
      : undefined;

    return {
      ...snapshot,
      ...(limitedSummaries ? { versions: limitedSummaries } : {}),
      ...(diff ? { diff } : {}),
    };
  }

  async listVersions(query: GetStartlistVersionsQuery): Promise<GetStartlistVersionsResult> {
    const startlistId = StartlistId.create(query.startlistId);
    await this.ensureStartlistExists(startlistId);

    const versions = sortVersionsDesc(await this.versionRepository.findVersions(startlistId));
    const offset = Math.max(0, query.offset ?? 0);
    const limit = query.limit ?? versions.length;
    const items = versions.slice(offset, offset + Math.max(0, limit));

    return {
      startlistId: startlistId.toString(),
      total: versions.length,
      items: items.map(toStartlistVersionDto),
    };
  }

  async diff(query: GetStartlistDiffQuery): Promise<StartlistDiffDto | undefined> {
    const startlistId = StartlistId.create(query.startlistId);
    await this.ensureStartlistExists(startlistId);

    const versions = sortVersionsDesc(await this.versionRepository.findVersions(startlistId));
    return this.buildDiffDto(startlistId, versions, query.fromVersion, query.toVersion);
  }

  private async ensureStartlistExists(startlistId: StartlistId): Promise<void> {
    const snapshot = await this.repository.findById(startlistId);
    if (!snapshot) {
      throw new StartlistNotFoundError(startlistId.toString());
    }
  }

  private buildDiffDto(
    startlistId: StartlistId,
    versions: StartlistVersion[],
    fromVersion?: number,
    toVersion?: number,
  ): StartlistDiffDto | undefined {
    if (!versions.length) {
      return undefined;
    }

    const resolvedTo = toVersion
      ? versions.find((version) => version.version === toVersion)
      : versions[0];

    if (!resolvedTo) {
      throw new StartlistVersionNotFoundError(startlistId.toString(), toVersion as number);
    }

    const resolvedFrom = (() => {
      if (fromVersion !== undefined) {
        return versions.find((version) => version.version === fromVersion);
      }
      return versions.find((version) => version.version < resolvedTo.version);
    })();

    if (fromVersion !== undefined && !resolvedFrom) {
      throw new StartlistVersionNotFoundError(startlistId.toString(), fromVersion);
    }

    const changes = diffStartlistSnapshots(resolvedFrom?.snapshot, resolvedTo.snapshot);

    return {
      startlistId: startlistId.toString(),
      to: toSummaryDto(resolvedTo),
      ...(resolvedFrom ? { from: toSummaryDto(resolvedFrom) } : {}),
      changes,
    };
  }
}

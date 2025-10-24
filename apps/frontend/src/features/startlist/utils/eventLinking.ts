import type { Dispatch } from 'react';

import { createStatus, setEventLinkStatus, setStatus } from '../state/StartlistContext';
import type { StartlistAction } from '../state/store/createStartlistStore';
import type { EventContext } from '../state/types';
import { buildStartlistPublicUrl, buildStartlistViewerPath } from './startlistLinks';
import type { AttachStartlistCommand } from '../../event-management/api/useEventManagementApi';

export type AutoAttachResult = 'skipped' | 'success' | 'error';

interface TryAutoAttachStartlistParams {
  dispatch: Dispatch<StartlistAction>;
  eventContext: EventContext;
  startlistId: string;
  version: number;
  confirmedAt: string;
  startlistStatus?: string;
  attachStartlist: (command: AttachStartlistCommand) => Promise<unknown>;
}

export const tryAutoAttachStartlist = async ({
  dispatch,
  eventContext,
  startlistId,
  version,
  confirmedAt,
  startlistStatus,
  attachStartlist,
}: TryAutoAttachStartlistParams): Promise<AutoAttachResult> => {
  const { eventId, raceId } = eventContext;
  if (!eventId || !raceId) {
    return 'skipped';
  }

  const publicUrl = buildStartlistPublicUrl(startlistId, version);
  const startlistLink = publicUrl ?? buildStartlistViewerPath(startlistId, version);

  const baseStatus = {
    eventId,
    raceId,
    startlistId,
    startlistUpdatedAt: confirmedAt,
    startlistPublicVersion: version,
    ...(startlistLink ? { startlistLink } : {}),
  } as const;

  setEventLinkStatus(dispatch, {
    status: 'linking',
    ...baseStatus,
  });

  try {
    const attachCommand: AttachStartlistCommand = {
      eventId,
      raceId,
      startlistId,
      confirmedAt,
      version,
      status: startlistStatus,
    };
    if (publicUrl !== undefined) {
      attachCommand.publicUrl = publicUrl;
    }
    await attachStartlist(attachCommand);
    setEventLinkStatus(dispatch, {
      status: 'success',
      ...baseStatus,
    });
    setStatus(dispatch, 'snapshot', createStatus('スタートリストをイベント管理に同期しました。', 'success'));
    return 'success';
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'イベント管理へのスタートリスト連携に失敗しました。';
    setEventLinkStatus(dispatch, {
      status: 'error',
      ...baseStatus,
      errorMessage: message,
    });
    setStatus(dispatch, 'snapshot', createStatus(message, 'error'));
    return 'error';
  }
};

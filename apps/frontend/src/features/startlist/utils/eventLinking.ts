import type { Dispatch } from 'react';

import { createStatus, setEventLinkStatus, setStatus } from '../state/StartlistContext';
import type { StartlistAction } from '../state/store/createStartlistStore';
import type { EventContext } from '../state/types';
import { buildStartlistPublicUrl } from './startlistLinks';

export type AutoAttachResult = 'skipped' | 'success' | 'error';

interface TryAutoAttachStartlistParams {
  dispatch: Dispatch<StartlistAction>;
  eventContext: EventContext;
  startlistId: string;
  version: number;
  confirmedAt: string;
}

export const tryAutoAttachStartlist = async ({
  dispatch,
  eventContext,
  startlistId,
  version,
  confirmedAt,
}: TryAutoAttachStartlistParams): Promise<AutoAttachResult> => {
  const { eventId, raceId } = eventContext;
  if (!eventId || !raceId) {
    return 'skipped';
  }

  const startlistLink = buildStartlistPublicUrl(startlistId, version);
  const baseStatus = {
    eventId,
    raceId,
    startlistId,
    startlistLink,
    startlistUpdatedAt: confirmedAt,
    startlistPublicVersion: version,
  } as const;

  setEventLinkStatus(dispatch, {
    status: 'linking',
    ...baseStatus,
  });

  setEventLinkStatus(dispatch, {
    status: 'success',
    ...baseStatus,
  });
  setStatus(dispatch, 'snapshot', createStatus('スタートリストをイベント管理に同期しました。', 'success'));
  return 'success';
};

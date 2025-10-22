import type { Dispatch } from 'react';
import type { AttachStartlistCommand } from '@event-management/application';

import { createStatus, setEventLinkStatus, setStatus } from '../state/StartlistContext';
import type { StartlistAction } from '../state/store/createStartlistStore';
import type { EventContext } from '../state/types';
import { buildStartlistPublicUrl } from './startlistLinks';

export type AutoAttachResult = 'skipped' | 'success' | 'error';

interface TryAutoAttachStartlistParams {
  dispatch: Dispatch<StartlistAction>;
  eventContext: EventContext;
  attachStartlist: (command: AttachStartlistCommand) => Promise<unknown>;
  startlistId: string;
  version: number;
  confirmedAt: string;
}

const ensureErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'スタートリストの自動連携に失敗しました。';
  }
};

export const tryAutoAttachStartlist = async ({
  dispatch,
  eventContext,
  attachStartlist,
  startlistId,
  version,
  confirmedAt,
}: TryAutoAttachStartlistParams): Promise<AutoAttachResult> => {
  const { eventId, raceId } = eventContext;
  if (!eventId || !raceId) {
    return 'skipped';
  }

  const startlistLink = buildStartlistPublicUrl(startlistId, version);
  if (!startlistLink) {
    const message = '公開用URLの設定がされていないため、自動連携できませんでした。';
    setEventLinkStatus(dispatch, {
      status: 'error',
      eventId,
      raceId,
      startlistUpdatedAt: confirmedAt,
      startlistPublicVersion: version,
      errorMessage: message,
    });
    setStatus(dispatch, 'snapshot', createStatus(message, 'error'));
    return 'error';
  }

  setEventLinkStatus(dispatch, {
    status: 'linking',
    eventId,
    raceId,
    startlistLink,
    startlistUpdatedAt: confirmedAt,
    startlistPublicVersion: version,
  });

  try {
    await attachStartlist({
      eventId,
      raceId,
      startlistLink,
      startlistUpdatedAt: confirmedAt,
      startlistPublicVersion: version,
    });

    setEventLinkStatus(dispatch, {
      status: 'success',
      eventId,
      raceId,
      startlistLink,
      startlistUpdatedAt: confirmedAt,
      startlistPublicVersion: version,
    });
    setStatus(dispatch, 'snapshot', createStatus('イベントにスタートリストを自動連携しました。', 'success'));
    return 'success';
  } catch (error) {
    const message = ensureErrorMessage(error);
    setEventLinkStatus(dispatch, {
      status: 'error',
      eventId,
      raceId,
      startlistLink,
      startlistUpdatedAt: confirmedAt,
      startlistPublicVersion: version,
      errorMessage: message,
    });
    setStatus(dispatch, 'snapshot', createStatus(message, 'error'));
    return 'error';
  }
};

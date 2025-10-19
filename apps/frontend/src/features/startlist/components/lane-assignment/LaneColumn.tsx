import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { LaneAssignmentDto } from '@startlist-management/application';

import type { LaneSummary } from '../../workflow/createLaneAssignmentViewModel';
import { laneContainerId } from '../../workflow/createLaneAssignmentViewModel';

export type LaneColumnProps = {
  lane: LaneAssignmentDto;
  summary?: LaneSummary;
  children: ReactNode;
};

const LaneColumn = ({ lane, summary, children }: LaneColumnProps): JSX.Element => {
  const { setNodeRef, isOver } = useDroppable({ id: laneContainerId(lane.laneNumber) });

  return (
    <div
      ref={setNodeRef}
      className={`lane-card droppable-card${isOver ? ' is-over' : ''}`}
      data-testid={`lane-column-${lane.laneNumber}`}
    >
      <h3>レーン {lane.laneNumber}</h3>
      {summary ? (
        <div className="meta-info lane-card__meta">
          <span className="meta-info__item">
            <span className="meta-info__label">人数</span>
            <span className="meta-info__value">{summary.competitorCount}名</span>
          </span>
          <span className="meta-info__item">
            <span className="meta-info__label">時間帯</span>
            <span className={`meta-info__value${summary.timeRangeLabel ? '' : ' is-muted'}`}>
              {summary.timeRangeLabel ?? '未設定'}
            </span>
          </span>
        </div>
      ) : null}
      {children}
    </div>
  );
};

export default LaneColumn;

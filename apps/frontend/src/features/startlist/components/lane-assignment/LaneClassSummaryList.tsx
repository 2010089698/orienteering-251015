import type { ReactNode } from 'react';

import type { ClassSummary } from '../../workflow/createLaneAssignmentViewModel';

export type LaneClassSummaryListProps = {
  summaries: ClassSummary[];
  emptyMessage?: string;
  emptyContent?: ReactNode;
};

const LaneClassSummaryList = ({
  summaries,
  emptyMessage = 'クラス未設定',
  emptyContent,
}: LaneClassSummaryListProps): JSX.Element => {
  if (summaries.length === 0) {
    if (emptyContent) {
      return <>{emptyContent}</>;
    }
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <ul className="lane-card__class-list">
      {summaries.map((summary) => (
        <li key={summary.classId} className="lane-card__class-item">
          <span className="lane-card__class-name">{summary.classId}</span>
          {summary.helperText ? (
            <span className="lane-card__class-helper muted small-text">{summary.helperText}</span>
          ) : null}
          <span className="lane-card__class-meta">
            <span>{summary.competitorCount}名</span>
            <span className={summary.timeRangeLabel ? '' : 'muted small-text'}>
              {summary.timeRangeLabel ?? '時間未設定'}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
};

export default LaneClassSummaryList;

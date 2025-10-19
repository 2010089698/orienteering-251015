import type { ComponentPropsWithoutRef, ElementType } from 'react';

import type { LaneSummary } from '../../hooks/useLaneAssignmentStep';
import LaneClassSummaryList from './LaneClassSummaryList';

export type LaneSummaryCardProps<WrapperElement extends ElementType = 'div'> = {
  laneNumber: number;
  summary?: LaneSummary;
  emptyMessage?: string;
  wrapper?: WrapperElement;
} & Omit<ComponentPropsWithoutRef<WrapperElement>, 'as' | 'children' | 'wrapper'>;

const LaneSummaryCard = <WrapperElement extends ElementType = 'div'>(
  {
    laneNumber,
    summary,
    emptyMessage = 'クラス未設定',
    className,
    wrapper,
    ...rest
  }: LaneSummaryCardProps<WrapperElement>,
): JSX.Element => {
  const Wrapper = (wrapper ?? 'div') as ElementType;
  const wrapperClassName = className ?? 'lane-card';
  const competitorCount = summary?.competitorCount ?? 0;
  const timeRangeLabel = summary?.timeRangeLabel;
  const classSummaries = summary?.classSummaries ?? [];

  return (
    <Wrapper className={wrapperClassName} {...rest}>
      <h3>レーン {laneNumber}</h3>
      <div className="meta-info lane-card__meta">
        <span className="meta-info__item">
          <span className="meta-info__label">人数</span>
          <span className="meta-info__value">{competitorCount}名</span>
        </span>
        <span className="meta-info__item">
          <span className="meta-info__label">時間帯</span>
          <span className={`meta-info__value${timeRangeLabel ? '' : ' is-muted'}`}>
            {timeRangeLabel ?? '未設定'}
          </span>
        </span>
      </div>
      <LaneClassSummaryList summaries={classSummaries} emptyMessage={emptyMessage} />
    </Wrapper>
  );
};

export default LaneSummaryCard;

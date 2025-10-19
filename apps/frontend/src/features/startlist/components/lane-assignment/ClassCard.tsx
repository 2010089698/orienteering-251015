import type { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type ClassCardProps = {
  classId: string;
  laneNumber: number;
  onLaneChange: (classId: string, lane: number) => void;
  laneOptions: number[];
  competitorCount: number;
  timeRangeLabel?: string;
  helperText?: string;
};

const ClassCard = ({
  classId,
  laneNumber,
  onLaneChange,
  laneOptions,
  competitorCount,
  timeRangeLabel,
  helperText,
}: ClassCardProps): JSX.Element => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: classId });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`draggable-card${isDragging ? ' is-dragging' : ''}`} {...attributes} {...listeners}>
      <div className="draggable-card__header">
        <span>{classId}</span>
        <label className="visually-hidden" htmlFor={`lane-select-${classId}`}>
          {classId} のレーン
        </label>
        <select
          id={`lane-select-${classId}`}
          value={laneNumber}
          onChange={(event) => onLaneChange(classId, Number(event.target.value))}
        >
          {laneOptions.map((lane) => (
            <option key={lane} value={lane}>
              レーン {lane}
            </option>
          ))}
        </select>
      </div>
      {helperText ? <p className="draggable-card__helper muted small-text">{helperText}</p> : null}
      <div className="meta-info draggable-card__meta">
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
    </div>
  );
};

export default ClassCard;

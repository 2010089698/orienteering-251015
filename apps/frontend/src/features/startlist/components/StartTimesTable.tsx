import type { StartlistWithHistoryDto } from '@startlist-management/application';

import { formatTime } from '../utils/startlistFormatting';

interface StartTimesTableProps {
  startTimes: StartlistWithHistoryDto['startTimes'];
  className?: string;
  ariaLabel?: string;
  startIndexOffset?: number;
}

const StartTimesTable = ({
  startTimes,
  className,
  ariaLabel,
  startIndexOffset = 0,
}: StartTimesTableProps) => {
  return (
    <table className={className} aria-label={ariaLabel}>
      <thead>
        <tr>
          <th scope="col">順番</th>
          <th scope="col">選手ID</th>
          <th scope="col">レーン</th>
          <th scope="col">スタート</th>
        </tr>
      </thead>
      <tbody>
        {startTimes.map((startTime, index) => {
          const displayOrder = startIndexOffset + index + 1;
          const formattedTime = formatTime(startTime.startTime);
          return (
            <tr key={`${startTime.playerId}-${startTime.startTime}-${index}`}>
              <th scope="row">{displayOrder}</th>
              <td>{startTime.playerId}</td>
              <td>{startTime.laneNumber}</td>
              <td>
                {formattedTime ? (
                  <time dateTime={startTime.startTime}>{formattedTime}</time>
                ) : (
                  <span aria-label="未定">-</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default StartTimesTable;

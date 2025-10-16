import { Tag } from '@orienteering/shared-ui';
import type { TagTone } from '@orienteering/shared-ui';
import type { StatusKey, StartlistState } from '../state/types';

interface StepDefinition {
  id: StatusKey;
  title: string;
  description: string;
}

const levelToTone: Record<StartlistState['statuses'][StatusKey]['level'], TagTone> = {
  idle: 'default',
  info: 'info',
  success: 'success',
  error: 'warning',
};

const levelLabel: Record<StartlistState['statuses'][StatusKey]['level'], string> = {
  idle: '未着手',
  info: '進行中',
  success: '完了',
  error: '要確認',
};

interface StepNavigationProps {
  steps: StepDefinition[];
  statuses: StartlistState['statuses'];
}

const StepNavigation = ({ steps, statuses }: StepNavigationProps): JSX.Element => {
  return (
    <nav aria-label="スタートリスト生成ステップ">
      <ul className="list-reset">
        {steps.map((step) => {
          const status = statuses[step.id];
          const tone = status ? levelToTone[status.level] : 'default';
          const label = status ? levelLabel[status.level] : '未着手';
          return (
            <li key={step.id}>
              <strong>{step.title}</strong>
              <div className="muted">{step.description}</div>
              <div className="inline-buttons" aria-live="polite">
                <Tag label={label} tone={tone} />
                {status?.text && <span className="muted">{status.text}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default StepNavigation;

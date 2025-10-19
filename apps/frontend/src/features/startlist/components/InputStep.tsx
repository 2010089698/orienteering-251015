import type { RefObject } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';

import SettingsForm, { type SettingsFormHandle } from './SettingsForm';
import EntryForm from './EntryForm';
import EntryTablePanel from './EntryTablePanel';
import StartOrderSettingsPanel from './StartOrderSettingsPanel';
import ClassSplitSettingsPanel from './ClassSplitSettingsPanel';
import type { StatusMessageState, Entry } from '../state/types';
import type { InputStepTab } from '../workflow/createInputStepViewModel';

export type InputStepProps = {
  tabs: InputStepTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  filteredEntries: Entry[];
  onComplete: () => void;
  status: StatusMessageState;
  settingsFormRef: RefObject<SettingsFormHandle>;
};

const InputStep = ({
  tabs,
  activeTab,
  onTabChange,
  filteredEntries,
  onComplete,
  status,
  settingsFormRef,
}: InputStepProps): JSX.Element => {
  return (
    <section aria-labelledby="step1-heading">
      <header>
        <h2 id="step1-heading">STEP 1 入力内容の整理</h2>
        <p className="muted">大会の基本情報と参加者を登録し、「入力完了」ボタンで次のステップへ進みます。</p>
      </header>
      <div className="input-step__layout">
        <div className="input-step__cell input-step__cell--settings">
          <SettingsForm ref={settingsFormRef} />
          <StartOrderSettingsPanel />
          <ClassSplitSettingsPanel />
        </div>
        <div className="input-step__cell input-step__cell--entry">
          <EntryForm />
        </div>
        <div className="input-step__cell input-step__cell--table">
          <EntryTablePanel tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} entries={filteredEntries} />
        </div>
      </div>
      <div className="actions-row step-actions step-actions--sticky">
        <button type="button" onClick={onComplete}>
          入力完了（レーンを自動作成）
        </button>
      </div>
      <StatusMessage tone={status.level} message={status.text} />
    </section>
  );
};

export default InputStep;

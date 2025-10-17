import { useMemo } from 'react';
import { Tabs } from '../../../components/tabs';
import EntryTable from './EntryTable';
import {
  createStatus,
  removeEntry,
  setStatus,
  useStartlistDispatch,
  useStartlistState,
} from '../state/StartlistContext';
import type { Entry } from '../state/types';

type EntryTableTab = {
  id: string;
  label: string;
  count: number;
};

type EntryTablePanelProps = {
  tabs: EntryTableTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  entries: Entry[];
};

const EntryTablePanel = ({ tabs, activeTab, onTabChange, entries }: EntryTablePanelProps): JSX.Element => {
  const { entries: allEntries } = useStartlistState();
  const dispatch = useStartlistDispatch();

  const tabItems = useMemo(
    () =>
      tabs.map((tab) => ({
        id: tab.id,
        label: `${tab.label} (${tab.count})`,
        panelId: `entry-panel-${tab.id}`,
      })),
    [tabs],
  );

  const selectedTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const emptyMessage = activeTab === 'all' ? '登録済みの参加者はまだいません。' : '該当する参加者がいません。';

  const handleRemove = (id: string) => {
    const remaining = Math.max(allEntries.length - 1, 0);
    removeEntry(dispatch, id);
    setStatus(dispatch, 'entries', createStatus(`${remaining} 件のエントリーがあります。`, 'info'));
  };

  return (
    <section aria-labelledby="entry-table-heading" className="entry-table-panel">
      <div className="entry-table-panel__header">
        <div>
          <h3 id="entry-table-heading">登録済みの参加者</h3>
          <p className="muted">
            合計 {allEntries.length} 件 / 表示 {entries.length} 件
            {selectedTab ? `（${selectedTab.label}: ${selectedTab.count} 件）` : ''}
          </p>
        </div>
        <Tabs
          activeId={activeTab}
          items={tabItems}
          onChange={onTabChange}
          idPrefix="entry-tab"
          ariaLabel="参加者一覧の表示切り替え"
        />
      </div>
      {tabItems.map((item) => (
        <div
          key={item.id}
          id={item.panelId}
          role="tabpanel"
          aria-labelledby={`entry-tab-${item.id}`}
          hidden={item.id !== activeTab}
          className="entry-table-panel__content"
        >
          <div className="entry-table-panel__scroll">
            <EntryTable entries={item.id === activeTab ? entries : []} onRemove={handleRemove} emptyMessage={emptyMessage} />
          </div>
        </div>
      ))}
    </section>
  );
};

export type { EntryTablePanelProps, EntryTableTab };
export default EntryTablePanel;

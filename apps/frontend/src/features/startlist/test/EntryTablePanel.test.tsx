import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useMemo, useState } from 'react';
import EntryTablePanel from '../components/EntryTablePanel';
import { useStartlistEntries } from '../state/StartlistContext';
import type { Entry } from '../state/types';
import { renderWithStartlist } from './test-utils';

const TabbedEntryTable = (): JSX.Element => {
  const entries = useStartlistEntries();
  const [activeTab, setActiveTab] = useState('all');

  const { tabs, filteredEntries } = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      counts.set(entry.classId, (counts.get(entry.classId) ?? 0) + 1);
    });
    const sortedClassIds = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b, 'ja'));
    const tabDefs = [
      { id: 'all', label: 'すべて', count: entries.length },
      ...sortedClassIds.map((classId) => ({ id: classId, label: classId, count: counts.get(classId) ?? 0 })),
    ];
    const filtered = activeTab === 'all' ? entries : entries.filter((entry) => entry.classId === activeTab);
    return { tabs: tabDefs, filteredEntries: filtered };
  }, [activeTab, entries]);

  return <EntryTablePanel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} entries={filteredEntries} />;
};

describe('EntryTablePanel', () => {
  const sampleEntries: Entry[] = [
    { id: 'entry-1', name: 'Alice', classId: 'M21', cardNo: '1001' },
    { id: 'entry-2', name: 'Bob', classId: 'W21', cardNo: '1002' },
    { id: 'entry-3', name: 'Charlie', classId: 'M21', cardNo: '1003' },
  ];

  it('filters visible rows when switching tabs', async () => {
    renderWithStartlist(<TabbedEntryTable />, {
      initialState: {
        entries: sampleEntries,
      },
    });

    const allRows = within(screen.getByRole('tabpanel')).getAllByRole('row');
    expect(allRows).toHaveLength(4);

    await userEvent.click(screen.getByRole('tab', { name: /M21/ }));
    const m21Panel = screen.getByRole('tabpanel');
    expect(within(m21Panel).getAllByRole('row')).toHaveLength(3);
    expect(within(m21Panel).queryByText('W21')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /W21/ }));
    const w21Panel = screen.getByRole('tabpanel');
    expect(within(w21Panel).getAllByRole('row')).toHaveLength(2);
    expect(within(w21Panel).queryByText('M21')).not.toBeInTheDocument();
  });
});

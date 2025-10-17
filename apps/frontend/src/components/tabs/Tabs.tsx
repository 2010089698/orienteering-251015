import { useCallback, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';

type TabItem = {
  id: string;
  label: string;
  panelId: string;
};

type TabsProps = {
  activeId: string;
  items: TabItem[];
  onChange: (nextId: string) => void;
  idPrefix?: string;
  ariaLabel?: string;
};

const Tabs = ({ activeId, items, onChange, idPrefix = 'tab', ariaLabel }: TabsProps): JSX.Element => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const buttonIds = useMemo(
    () => items.map((item) => `${idPrefix}-${item.id}`),
    [idPrefix, items],
  );

  const focusTab = useCallback(
    (index: number) => {
      if (!items.length) {
        return;
      }
      const clampedIndex = (index + items.length) % items.length;
      const nextItem = items[clampedIndex];
      const node = tabRefs.current[clampedIndex];
      node?.focus();
      if (nextItem) {
        onChange(nextItem.id);
      }
    },
    [items, onChange],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      if (!items.length) {
        return;
      }
      switch (event.key) {
        case 'ArrowRight':
        case 'Right':
          event.preventDefault();
          focusTab(currentIndex + 1);
          break;
        case 'ArrowLeft':
        case 'Left':
          event.preventDefault();
          focusTab(currentIndex - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusTab(0);
          break;
        case 'End':
          event.preventDefault();
          focusTab(items.length - 1);
          break;
        default:
          break;
      }
    },
    [focusTab, items.length],
  );

  return (
    <div role="tablist" aria-label={ariaLabel} className="tabs" aria-orientation="horizontal">
      {items.map((item, index) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            id={buttonIds[index]}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            className={isActive ? 'tabs__tab is-active' : 'tabs__tab'}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={item.panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export type { TabItem };
export default Tabs;

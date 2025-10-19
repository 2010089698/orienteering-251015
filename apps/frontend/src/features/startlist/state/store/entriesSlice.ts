import type { Entry, EntryDraft } from '../types';

export type EntryInput = Entry | EntryDraft;

const hasEntryId = (entry: EntryInput): entry is Entry =>
  typeof (entry as Entry).id === 'string' && (entry as Entry).id.length > 0;

let entryIdCounter = 0;

export const generateEntryId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // fall back to incremental IDs below
    }
  }
  entryIdCounter += 1;
  return `entry-${Date.now()}-${entryIdCounter}`;
};

export const ensureEntryId = (entry: EntryInput): Entry => {
  if (hasEntryId(entry)) {
    return entry;
  }
  return {
    ...entry,
    id: generateEntryId(),
  };
};

export const ensureEntryIds = (entries: EntryInput[]): Entry[] => entries.map((entry) => ensureEntryId(entry));

export const initialEntriesState: Entry[] = [];

export type EntriesAction =
  | { type: 'entries/add'; payload: EntryInput }
  | { type: 'entries/remove'; payload: { id: string } }
  | { type: 'entries/set'; payload: EntryInput[] };

export const entriesReducer = (state: Entry[], action: EntriesAction): Entry[] => {
  switch (action.type) {
    case 'entries/add':
      return [...state, ensureEntryId(action.payload)];
    case 'entries/remove':
      return state.filter((entry) => entry.id !== action.payload.id);
    case 'entries/set':
      return ensureEntryIds(action.payload);
    default:
      return state;
  }
};

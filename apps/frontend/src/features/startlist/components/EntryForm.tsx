import { useEffect, useRef, useState } from 'react';
import { StatusMessage } from '@orienteering/shared-ui';
import {
  appendEntry,
  createStatus,
  setStatus,
  updateEntries,
  updateEntry,
  useStartlistDispatch,
  useStartlistEntries,
  useStartlistEditingEntryId,
  useSetStartlistEditingEntryId,
  useStartlistStatuses,
} from '../state/StartlistContext';
import { RENTAL_CARD_LABEL, type Entry, type EntryDraft } from '../state/types';
import { parseEntriesFromCsvFile } from '../utils/entryCsv';

const emptyEntry: EntryDraft = {
  name: '',
  club: '',
  classId: '',
  cardNo: '',
  iofId: '',
};

const EntryForm = (): JSX.Element => {
  const entries = useStartlistEntries();
  const statuses = useStartlistStatuses();
  const dispatch = useStartlistDispatch();
  const editingEntryId = useStartlistEditingEntryId();
  const setEditingEntryId = useSetStartlistEditingEntryId();
  const [form, setForm] = useState<EntryDraft>({ ...emptyEntry });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editingEntry = editingEntryId ? entries.find((entry) => entry.id === editingEntryId) : undefined;
  const isEditing = Boolean(editingEntryId);

  useEffect(() => {
    if (editingEntry) {
      setForm({
        name: editingEntry.name,
        club: editingEntry.club ?? '',
        classId: editingEntry.classId,
        cardNo: editingEntry.cardNo === RENTAL_CARD_LABEL ? '' : editingEntry.cardNo,
        iofId: editingEntry.iofId ?? '',
      });
    } else if (!editingEntryId) {
      setForm({ ...emptyEntry });
    }
  }, [editingEntry, editingEntryId]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    setEditingEntryId(undefined);
    setForm({ ...emptyEntry });
    setStatus(dispatch, 'entries', createStatus('編集をキャンセルしました。', 'info'));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const classId = form.classId.trim();
    if (!classId) {
      setStatus(dispatch, 'entries', createStatus('クラスを入力してください。', 'error'));
      return;
    }
    const normalizedCard = form.cardNo.trim();
    const cardNo = normalizedCard || RENTAL_CARD_LABEL;
    const duplicate =
      cardNo !== RENTAL_CARD_LABEL &&
      entries.some((entry) => entry.cardNo === cardNo && entry.id !== editingEntryId);
    if (duplicate) {
      setStatus(dispatch, 'entries', createStatus('同じカード番号の参加者が登録されています。', 'error'));
      return;
    }

    const entry: EntryDraft = {
      name: form.name.trim(),
      club: form.club?.trim() ?? '',
      classId,
      cardNo,
    };

    const normalizedIofId = form.iofId?.replace(/\s+/g, '').toUpperCase() ?? '';
    if (normalizedIofId) {
      entry.iofId = normalizedIofId;
    }

    if (isEditing) {
      if (!editingEntry) {
        setStatus(
          dispatch,
          'entries',
          createStatus('編集対象の参加者が見つかりません。', 'error'),
        );
        setEditingEntryId(undefined);
        setForm({ ...emptyEntry });
        return;
      }

      const updatedEntry: Entry = {
        ...editingEntry,
        ...entry,
        ...(normalizedIofId ? { iofId: normalizedIofId } : { iofId: undefined }),
      };

      updateEntry(dispatch, updatedEntry);
      setStatus(
        dispatch,
        'entries',
        createStatus('参加者情報を更新しました。', 'success'),
      );
      setEditingEntryId(undefined);
      setForm({ ...emptyEntry });
      return;
    }

    appendEntry(dispatch, entry);
    setStatus(
      dispatch,
      'entries',
      createStatus(`${entries.length + 1} 人の参加者を登録しました。`, 'success'),
    );
    setForm({ ...emptyEntry });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const newEntries = await parseEntriesFromCsvFile(file, entries);

      if (newEntries.length === 0) {
        setStatus(
          dispatch,
          'entries',
          createStatus('CSV に有効な参加者の行が見つかりませんでした。', 'info'),
        );
        return;
      }
      updateEntries(dispatch, [...entries, ...newEntries]);
      setStatus(
        dispatch,
        'entries',
        createStatus(`CSV から ${newEntries.length} 人の参加者を追加しました。`, 'success'),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV の読み込みに失敗しました。';
      setStatus(dispatch, 'entries', createStatus(message, 'error'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section aria-labelledby="entry-heading">
      <header>
        <h2 id="entry-heading">参加者の登録</h2>
        <p className="muted">名前・所属・クラス・カード番号を順に入力してください。</p>
        {isEditing && (
          <p className="muted small" aria-live="polite">
            現在「{editingEntry?.name || '（未入力）'}」を編集中です。
          </p>
        )}
      </header>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          選手名
          <input name="name" value={form.name} onChange={handleChange} placeholder="山田 太郎" />
        </label>
        <label>
          所属クラブ
          <input name="club" value={form.club} onChange={handleChange} placeholder="Tokyo OL Club" />
        </label>
        <label>
          クラス
          <input name="classId" value={form.classId} onChange={handleChange} placeholder="M21E" required />
        </label>
        <label>
          IOF ID
          <input name="iofId" value={form.iofId} onChange={handleChange} placeholder="123456" />
        </label>
        <label>
          カード番号
          <input name="cardNo" value={form.cardNo} onChange={handleChange} placeholder="123456" />
        </label>
        <div className="actions-row">
          <button type="submit">{isEditing ? '参加者を更新' : '参加者を追加'}</button>
          {isEditing && (
            <button type="button" className="secondary" onClick={handleCancel}>
              編集をキャンセル
            </button>
          )}
        </div>
      </form>
      <div className="file-upload">
        <label htmlFor="entry-upload">
          CSV から参加者を一括登録
          <input
            id="entry-upload"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
          />
        </label>
        <p className="muted small">
          ヘッダーに <code>name</code>・<code>club</code>・<code>class</code>・<code>card number</code> を含む CSV または
          日本語の二段ヘッダー（例: 1 行目 <code>チーム名(氏名)</code>・<code>所属</code>・<code>クラス</code>・<code>カード番号</code>）
          をアップロードしてください。列の順番が <code>名前</code> → <code>所属</code> → <code>クラス</code> → <code>カード番号</code>
          になるサンプルは下記です。
        </p>
        <pre className="muted small">
チーム名(氏名),所属,クラス,カード番号
山田 太郎,TOKYO OL,M21E,123456
        </pre>
      </div>
      <StatusMessage tone={statuses.entries.level} message={statuses.entries.text} />
    </section>
  );
};

export default EntryForm;

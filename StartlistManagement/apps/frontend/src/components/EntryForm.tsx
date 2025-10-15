import { useState } from 'react';
import { StatusMessage } from '@startlist-management/ui-components';
import { appendEntry, createStatus, setStatus, useStartlistDispatch, useStartlistState } from '../state/StartlistContext';
import type { Entry } from '../state/types';

const emptyEntry: Entry = {
  name: '',
  club: '',
  classId: '',
  cardNo: '',
};

const EntryForm = (): JSX.Element => {
  const { entries, statuses } = useStartlistState();
  const dispatch = useStartlistDispatch();
  const [form, setForm] = useState<Entry>({ ...emptyEntry });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.classId.trim() || !form.cardNo.trim()) {
      setStatus(dispatch, 'entries', createStatus('クラス ID とカード番号は必須です。', 'error'));
      return;
    }
    const normalizedCard = form.cardNo.trim();
    const duplicate = entries.some((entry) => entry.cardNo === normalizedCard);
    if (duplicate) {
      setStatus(dispatch, 'entries', createStatus('同じカード番号のエントリーが既に存在します。', 'error'));
      return;
    }

    const entry: Entry = {
      name: form.name.trim(),
      club: form.club?.trim() ?? '',
      classId: form.classId.trim(),
      cardNo: normalizedCard,
    };

    appendEntry(dispatch, entry);
    setStatus(
      dispatch,
      'entries',
      createStatus(`${entries.length + 1} 件のエントリーがあります。`, 'success'),
    );
    setForm({ ...emptyEntry });
  };

  return (
    <section aria-labelledby="entry-heading">
      <header>
        <h2 id="entry-heading">エントリー入力</h2>
        <p className="muted">選手名や所属クラブ、カード番号を登録します。</p>
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
          クラス ID
          <input name="classId" value={form.classId} onChange={handleChange} placeholder="M21E" required />
        </label>
        <label>
          カード番号
          <input name="cardNo" value={form.cardNo} onChange={handleChange} placeholder="123456" required />
        </label>
        <div className="actions-row">
          <button type="submit">エントリー追加</button>
        </div>
      </form>
      <StatusMessage tone={statuses.entries.level} message={statuses.entries.text} />
    </section>
  );
};

export default EntryForm;

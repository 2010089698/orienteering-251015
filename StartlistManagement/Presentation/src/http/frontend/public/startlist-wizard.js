(() => {
  const state = {
    startlistId: '',
    settings: null,
    entries: [],
    laneAssignments: [],
    classAssignments: [],
    startTimes: [],
    snapshot: null,
  };

  const entryTableBody = document.getElementById('entry-table-body');
  const entryStatus = document.getElementById('entry-status');
  const laneContainer = document.getElementById('lane-assignments');
  const laneStatus = document.getElementById('lane-status');
  const classContainer = document.getElementById('class-assignments');
  const classStatus = document.getElementById('class-status');
  const startTimesTable = document.getElementById('start-times-table');
  const startTimesStatus = document.getElementById('start-times-status');
  const settingsStatus = document.getElementById('settings-status');
  const snapshotViewer = document.getElementById('snapshot-viewer');

  const getFormData = (form) => Object.fromEntries(new FormData(form).entries());

  const renderEntries = () => {
    entryTableBody.innerHTML = '';
    state.entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      row.innerHTML = [
        `<td>${entry.name}</td>`,
        `<td>${entry.club || ''}</td>`,
        `<td><span class="tag">${entry.classId}</span></td>`,
        `<td>${entry.cardNo}</td>`,
        `<td><button data-action="remove" data-index="${index}">削除</button></td>`,
      ].join('');
      entryTableBody.appendChild(row);
    });
  };

  entryTableBody.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLButtonElement && target.dataset.action === 'remove') {
      const index = Number.parseInt(target.dataset.index || '-1', 10);
      if (!Number.isNaN(index)) {
        state.entries.splice(index, 1);
        renderEntries();
        entryStatus.textContent = 'エントリーを削除しました。';
        entryStatus.className = 'status success';
      }
    }
  });

  document.getElementById('entry-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = getFormData(form);
    const cardNo = (data.cardNo || '').trim();
    const classId = (data.classId || '').trim();
    if (!cardNo || !classId) {
      entryStatus.textContent = 'クラス ID とカード番号は必須です。';
      entryStatus.className = 'status error';
      return;
    }
    const existing = state.entries.find((entry) => entry.cardNo === cardNo);
    if (existing) {
      entryStatus.textContent = '同じカード番号のエントリーが既に存在します。';
      entryStatus.className = 'status error';
      return;
    }
    state.entries.push({
      name: (data.name || '').toString().trim(),
      club: (data.club || '').toString().trim(),
      classId,
      cardNo,
    });
    renderEntries();
    entryStatus.textContent = `${state.entries.length} 件のエントリーがあります。`;
    entryStatus.className = 'status success';
    form.reset();
  });

  const ensureSettingsReady = () => {
    if (!state.settings || !state.startlistId) {
      throw new Error('まず基本情報を送信してください。');
    }
  };

  document.getElementById('settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = getFormData(form);
    const startlistId = (data.startlistId || '').toString().trim();
    if (!startlistId) {
      settingsStatus.textContent = 'スタートリスト ID を入力してください。';
      settingsStatus.className = 'status error';
      return;
    }
    const startTimeValue = (data.startTime || '').toString();
    if (!startTimeValue) {
      settingsStatus.textContent = '開始時刻を入力してください。';
      settingsStatus.className = 'status error';
      return;
    }
    const startTimeIso = new Date(startTimeValue).toISOString();
    const minutes = Number.parseInt(data.intervalMinutes?.toString() || '0', 10) || 0;
    const seconds = Number.parseInt(data.intervalSeconds?.toString() || '0', 10) || 0;
    const intervalMs = (minutes * 60 + seconds) * 1000;
    if (intervalMs <= 0) {
      settingsStatus.textContent = 'スタート間隔は 1 秒以上にしてください。';
      settingsStatus.className = 'status error';
      return;
    }
    const laneCount = Number.parseInt(data.laneCount?.toString() || '0', 10);
    if (!Number.isInteger(laneCount) || laneCount <= 0) {
      settingsStatus.textContent = 'レーン数は 1 以上の整数で入力してください。';
      settingsStatus.className = 'status error';
      return;
    }
    try {
      const payload = {
        eventId: (data.eventId || '').toString().trim(),
        startTime: startTimeIso,
        interval: { milliseconds: intervalMs },
        laneCount,
      };
      const response = await fetch(`/api/startlists/${encodeURIComponent(startlistId)}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`設定の送信に失敗しました (${response.status})`);
      }
      const result = await response.json();
      state.startlistId = startlistId;
      state.settings = result.settings;
      state.snapshot = result;
      settingsStatus.textContent = '設定を保存しました。';
      settingsStatus.className = 'status success';
      updateSnapshot(result);
    } catch (error) {
      settingsStatus.textContent = error instanceof Error ? error.message : '設定送信時に不明なエラーが発生しました。';
      settingsStatus.className = 'status error';
    }
  });

  document.getElementById('refresh-snapshot').addEventListener('click', async () => {
    try {
      ensureSettingsReady();
      const response = await fetch(`/api/startlists/${encodeURIComponent(state.startlistId)}`);
      if (!response.ok) {
        throw new Error(`スナップショット取得に失敗しました (${response.status})`);
      }
      const result = await response.json();
      state.snapshot = result;
      updateSnapshot(result);
      settingsStatus.textContent = '最新状態を取得しました。';
      settingsStatus.className = 'status success';
    } catch (error) {
      settingsStatus.textContent = error instanceof Error ? error.message : '最新状態の取得に失敗しました。';
      settingsStatus.className = 'status error';
    }
  });

  const groupEntriesByClass = () => {
    const map = new Map();
    state.entries.forEach((entry) => {
      const classId = entry.classId.trim();
      if (!map.has(classId)) {
        map.set(classId, []);
      }
      map.get(classId).push(entry);
    });
    return map;
  };

  const renderLaneAssignments = () => {
    laneContainer.innerHTML = '';
    if (state.laneAssignments.length === 0) {
      laneContainer.innerHTML = '<p>レーン割り当てが未計算です。</p>';
      return;
    }
    state.laneAssignments.forEach((assignment) => {
      const wrapper = document.createElement('details');
      wrapper.open = true;
      wrapper.innerHTML = `
        <summary>レーン ${assignment.laneNumber} <span class="tag">${assignment.classOrder.length} クラス</span></summary>
        <p>インターバル: ${assignment.interval.milliseconds} ミリ秒</p>
        <ul>${assignment.classOrder.map((classId) => `<li>${classId}</li>`).join('')}</ul>
      `;
      laneContainer.appendChild(wrapper);
    });
  };

  document.getElementById('generate-lane-order').addEventListener('click', () => {
    try {
      ensureSettingsReady();
      const grouped = groupEntriesByClass();
      if (grouped.size === 0) {
        laneStatus.textContent = 'エントリーを追加してください。';
        laneStatus.className = 'status error';
        return;
      }
      const laneCount = state.settings.laneCount;
      const classes = Array.from(grouped.entries()).map(([classId, entries]) => ({
        classId,
        entries,
        count: entries.length,
      }));
      classes.sort((a, b) => {
        if (b.count === a.count) {
          return a.classId.localeCompare(b.classId);
        }
        return b.count - a.count;
      });
      const lanes = Array.from({ length: laneCount }, (_, index) => ({
        laneNumber: index + 1,
        classOrder: [],
        load: 0,
      }));
      classes.forEach((klass) => {
        lanes.sort((a, b) => {
          if (a.load === b.load) {
            return a.laneNumber - b.laneNumber;
          }
          return a.load - b.load;
        });
        lanes[0].classOrder.push(klass.classId);
        lanes[0].load += klass.count;
      });
      const interval = state.settings.interval;
      state.laneAssignments = lanes
        .filter((lane) => lane.classOrder.length > 0)
        .map((lane) => ({
          laneNumber: lane.laneNumber,
          classOrder: lane.classOrder,
          interval,
        }));
      renderLaneAssignments();
      laneStatus.textContent = 'レーン割り当て案を作成しました。';
      laneStatus.className = 'status success';
    } catch (error) {
      laneStatus.textContent = error instanceof Error ? error.message : 'レーン割り当ての生成に失敗しました。';
      laneStatus.className = 'status error';
    }
  });

  document.getElementById('submit-lane-order').addEventListener('click', async () => {
    try {
      ensureSettingsReady();
      if (state.laneAssignments.length === 0) {
        throw new Error('送信するレーン割り当てがありません。');
      }
      const response = await fetch(`/api/startlists/${encodeURIComponent(state.startlistId)}/lane-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: state.laneAssignments }),
      });
      if (!response.ok) {
        throw new Error(`レーン割り当て送信に失敗しました (${response.status})`);
      }
      const result = await response.json();
      state.snapshot = result;
      updateSnapshot(result);
      laneStatus.textContent = 'レーン割り当てを保存しました。';
      laneStatus.className = 'status success';
    } catch (error) {
      laneStatus.textContent = error instanceof Error ? error.message : 'レーン割り当ての送信に失敗しました。';
      laneStatus.className = 'status error';
    }
  });

  const renderClassAssignments = () => {
    classContainer.innerHTML = '';
    if (state.classAssignments.length === 0) {
      classContainer.innerHTML = '<p>クラス内順序が未計算です。</p>';
      return;
    }
    const entryByCard = new Map(state.entries.map((entry) => [entry.cardNo, entry]));
    state.classAssignments.forEach((assignment) => {
      const detailsEl = document.createElement('details');
      detailsEl.open = true;
      const playersMarkup = assignment.playerOrder
        .map((playerId) => {
          const entry = entryByCard.get(playerId);
          const label = entry ? `${entry.name} (${playerId})` : playerId;
          const club = entry?.club ? `<span class="tag">${entry.club}</span>` : '';
          return `<li data-player-id="${playerId}"><span>${label}</span>${club}<span class="player-controls"><button data-action="move-up" data-class-id="${assignment.classId}" data-player-id="${playerId}">↑</button><button data-action="move-down" data-class-id="${assignment.classId}" data-player-id="${playerId}">↓</button></span></li>`;
        })
        .join('');
      detailsEl.innerHTML = `
        <summary>クラス ${assignment.classId} <span class="tag">${assignment.playerOrder.length} 名</span></summary>
        <p>インターバル: ${assignment.interval.milliseconds} ミリ秒</p>
        <ul class="player-list">${playersMarkup}</ul>
      `;
      classContainer.appendChild(detailsEl);
    });
  };

  const sortByCardNumber = (entries) => {
    return entries.slice().sort((a, b) => {
      const aNum = Number(a.cardNo);
      const bNum = Number(b.cardNo);
      const aIsNumber = Number.isFinite(aNum);
      const bIsNumber = Number.isFinite(bNum);
      if (aIsNumber && bIsNumber && aNum !== bNum) {
        return aNum - bNum;
      }
      return a.cardNo.localeCompare(b.cardNo);
    });
  };

  document.getElementById('generate-class-order').addEventListener('click', () => {
    try {
      ensureSettingsReady();
      const grouped = groupEntriesByClass();
      if (grouped.size === 0) {
        classStatus.textContent = 'エントリーを追加してください。';
        classStatus.className = 'status error';
        return;
      }
      const interval = state.settings.interval;
      state.classAssignments = Array.from(grouped.entries()).map(([classId, entries]) => {
        const sorted = sortByCardNumber(entries);
        return {
          classId,
          playerOrder: sorted.map((entry) => entry.cardNo),
          interval,
        };
      });
      state.classAssignments.sort((a, b) => a.classId.localeCompare(b.classId));
      renderClassAssignments();
      classStatus.textContent = 'クラス内順序案を作成しました。';
      classStatus.className = 'status success';
    } catch (error) {
      classStatus.textContent = error instanceof Error ? error.message : 'クラス内順序の生成に失敗しました。';
      classStatus.className = 'status error';
    }
  });

  classContainer.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const classId = target.dataset.classId;
    const playerId = target.dataset.playerId;
    if (!classId || !playerId) {
      return;
    }
    const assignment = state.classAssignments.find((item) => item.classId === classId);
    if (!assignment) {
      return;
    }
    const index = assignment.playerOrder.findIndex((id) => id === playerId);
    if (index === -1) {
      return;
    }
    if (target.dataset.action === 'move-up' && index > 0) {
      const tmp = assignment.playerOrder[index - 1];
      assignment.playerOrder[index - 1] = assignment.playerOrder[index];
      assignment.playerOrder[index] = tmp;
      renderClassAssignments();
    }
    if (target.dataset.action === 'move-down' && index < assignment.playerOrder.length - 1) {
      const tmp = assignment.playerOrder[index + 1];
      assignment.playerOrder[index + 1] = assignment.playerOrder[index];
      assignment.playerOrder[index] = tmp;
      renderClassAssignments();
    }
  });

  document.getElementById('submit-class-order').addEventListener('click', async () => {
    try {
      ensureSettingsReady();
      if (state.classAssignments.length === 0) {
        throw new Error('送信するクラス内順序がありません。');
      }
      const response = await fetch(`/api/startlists/${encodeURIComponent(state.startlistId)}/player-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: state.classAssignments }),
      });
      if (!response.ok) {
        throw new Error(`クラス内順序送信に失敗しました (${response.status})`);
      }
      const result = await response.json();
      state.snapshot = result;
      updateSnapshot(result);
      classStatus.textContent = 'クラス内順序を保存しました。';
      classStatus.className = 'status success';
    } catch (error) {
      classStatus.textContent = error instanceof Error ? error.message : 'クラス内順序の送信に失敗しました。';
      classStatus.className = 'status error';
    }
  });

  const generateStartTimes = () => {
    ensureSettingsReady();
    if (state.laneAssignments.length === 0 || state.classAssignments.length === 0) {
      throw new Error('レーン割り当てとクラス内順序を先に生成してください。');
    }
    const baseTime = new Date(state.settings.startTime).getTime();
    const classMap = new Map(state.classAssignments.map((assignment) => [assignment.classId, assignment]));
    const startTimes = [];
    const laneState = new Map();
    state.laneAssignments.forEach((lane) => {
      laneState.set(lane.laneNumber, baseTime);
      lane.classOrder.forEach((classId) => {
        const classAssignment = classMap.get(classId);
        if (!classAssignment) {
          return;
        }
        let laneTime = laneState.get(lane.laneNumber) || baseTime;
        classAssignment.playerOrder.forEach((playerId) => {
          startTimes.push({
            playerId,
            classId,
            laneNumber: lane.laneNumber,
            startTime: new Date(laneTime).toISOString(),
          });
          laneTime += classAssignment.interval.milliseconds;
        });
        laneState.set(lane.laneNumber, laneTime);
      });
    });
    state.startTimes = startTimes;
    renderStartTimes();
  };

  const renderStartTimes = () => {
    startTimesTable.innerHTML = '';
    if (state.startTimes.length === 0) {
      return;
    }
    const entryByCard = new Map(state.entries.map((entry) => [entry.cardNo, entry]));
    state.startTimes.forEach((item) => {
      const row = document.createElement('tr');
      const entry = entryByCard.get(item.playerId);
      const name = entry ? entry.name : '';
      const classId = entry ? entry.classId : item.classId;
      row.innerHTML = [
        `<td>${item.playerId}</td>`,
        `<td>${classId}</td>`,
        `<td>${name}</td>`,
        `<td>${item.laneNumber}</td>`,
        `<td>${new Date(item.startTime).toLocaleString()}</td>`,
      ].join('');
      startTimesTable.appendChild(row);
    });
  };

  document.getElementById('generate-start-times').addEventListener('click', () => {
    try {
      generateStartTimes();
      startTimesStatus.textContent = 'スタート時間を計算しました。';
      startTimesStatus.className = 'status success';
    } catch (error) {
      startTimesStatus.textContent = error instanceof Error ? error.message : 'スタート時間の計算に失敗しました。';
      startTimesStatus.className = 'status error';
    }
  });

  document.getElementById('submit-start-times').addEventListener('click', async () => {
    try {
      ensureSettingsReady();
      if (state.startTimes.length === 0) {
        throw new Error('送信するスタート時間がありません。');
      }
      const payload = {
        startTimes: state.startTimes.map((item) => ({
          playerId: item.playerId,
          laneNumber: item.laneNumber,
          startTime: item.startTime,
        })),
      };
      const response = await fetch(`/api/startlists/${encodeURIComponent(state.startlistId)}/start-times`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`スタート時間送信に失敗しました (${response.status})`);
      }
      const result = await response.json();
      state.snapshot = result;
      updateSnapshot(result);
      startTimesStatus.textContent = 'スタート時間を保存しました。';
      startTimesStatus.className = 'status success';
    } catch (error) {
      startTimesStatus.textContent = error instanceof Error ? error.message : 'スタート時間の送信に失敗しました。';
      startTimesStatus.className = 'status error';
    }
  });

  document.getElementById('invalidate-start-times').addEventListener('click', async () => {
    try {
      ensureSettingsReady();
      const reason = prompt('スタート時間をリセットする理由を入力してください', '手動調整のため');
      if (!reason) {
        return;
      }
      const response = await fetch(`/api/startlists/${encodeURIComponent(state.startlistId)}/start-times/invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        throw new Error(`スタート時間リセットに失敗しました (${response.status})`);
      }
      const result = await response.json();
      state.snapshot = result;
      state.startTimes = [];
      renderStartTimes();
      updateSnapshot(result);
      startTimesStatus.textContent = 'スタート時間をリセットしました。';
      startTimesStatus.className = 'status success';
    } catch (error) {
      startTimesStatus.textContent = error instanceof Error ? error.message : 'スタート時間のリセットに失敗しました。';
      startTimesStatus.className = 'status error';
    }
  });

  document.getElementById('finalize-startlist').addEventListener('click', async () => {
    try {
      ensureSettingsReady();
      const response = await fetch(`/api/startlists/${encodeURIComponent(state.startlistId)}/finalize`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`スタートリストの確定に失敗しました (${response.status})`);
      }
      const result = await response.json();
      state.snapshot = result;
      updateSnapshot(result);
      startTimesStatus.textContent = 'スタートリストを確定しました。';
      startTimesStatus.className = 'status success';
    } catch (error) {
      startTimesStatus.textContent = error instanceof Error ? error.message : 'スタートリストの確定に失敗しました。';
      startTimesStatus.className = 'status error';
    }
  });

  const updateSnapshot = (snapshot) => {
    snapshotViewer.textContent = JSON.stringify(snapshot, null, 2);
  };
})();

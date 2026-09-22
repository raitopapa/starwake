const KEY = 'starwake.horizon.v2';
const defaults = () => ({ sound: true, music: .65, sfx: .8, effects: true, difficulty: 'pilot', stage: 0, loadout: 'lance', records: {} });
export function readSave(storage) {
  const data = defaults();
  try {
    const raw = JSON.parse(storage.getItem(KEY)); if (!raw || typeof raw !== 'object') return data;
    for (const key of ['sound','effects']) if (typeof raw[key] === 'boolean') data[key] = raw[key];
    for (const key of ['music','sfx']) if (Number.isFinite(raw[key])) data[key] = Math.min(1, Math.max(0, raw[key]));
    if (['cadet','pilot','ace'].includes(raw.difficulty)) data.difficulty = raw.difficulty;
    if (Number.isInteger(raw.stage) && raw.stage >= 0 && raw.stage <= 2) data.stage = raw.stage;
    if (['lance','wave','seeker'].includes(raw.loadout)) data.loadout = raw.loadout;
    if (raw.records && typeof raw.records === 'object') for (const [key, score] of Object.entries(raw.records)) {
      if (/^(cadet|pilot|ace):[012]:(lance|wave|seeker)$/.test(key) && Number.isFinite(score) && score >= 0) data.records[key] = Math.floor(score);
    }
  } catch {}
  return data;
}
export function writeSave(storage, save) { try { storage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; } }
export function recordRun(save, game) {
  const key = `${game.difficulty}:${game.startStage}:${game.loadout.id}`, old = save.records[key] || 0;
  if (game.score > old) save.records[key] = Math.floor(game.score);
  return game.score > old;
}

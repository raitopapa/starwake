const KEY = 'starwake.zenith.v2';
const defaults = () => ({ sound: true, music: .65, sfx: .8, effects: true, difficulty: 'pilot', stage: 0, records: {} });
export function readSave(storage) {
  try {
    const current = storage.getItem(KEY);
    const raw = JSON.parse(current || storage.getItem('starwake.v1'));
    if (!current && raw) raw.records = {};
    if (!raw || typeof raw !== 'object') return defaults();
    const data = defaults();
    for(const key of ['music','sfx'])if(Number.isFinite(raw[key]))data[key]=Math.max(0,Math.min(1,raw[key]));
    if(typeof raw.effects==='boolean')data.effects=raw.effects;
    data.sound = typeof raw.sound === 'boolean' ? raw.sound : true;
    data.difficulty = ['cadet', 'pilot', 'ace'].includes(raw.difficulty) ? raw.difficulty : 'pilot';
    data.stage = Number.isInteger(raw.stage) && raw.stage >= 0 && raw.stage <= 2 ? raw.stage : 0;
    if (raw.records && typeof raw.records === 'object') {
      for (const [key, score] of Object.entries(raw.records)) if (/^(cadet|pilot|ace):[012]$/.test(key) && Number.isFinite(score) && score >= 0) data.records[key] = Math.floor(score);
    }
    return data;
  } catch { return defaults(); }
}
export function writeSave(storage, save) { try { storage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; } }
export function recordRun(save, game) {
  const key = `${game.difficulty}:${game.startStage}`, old = save.records[key] || 0;
  if (game.score > old) save.records[key] = Math.floor(game.score);
  return game.score > old;
}

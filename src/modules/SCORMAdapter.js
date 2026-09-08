/**
 * SCORMAdapter — bridges to SCORM 2004 4th Edition API.
 * Gracefully degrades to console-only if no LMS is present (standalone mode).
 */
export class SCORMAdapter {
  constructor() {
    this._api    = null;
    this._ready  = false;
    this._init();
  }

  _findAPI(win) {
    let attempts = 0;
    while (!win.API_1484_11 && win.parent && win.parent !== win && attempts < 7) {
      win = win.parent;
      attempts++;
    }
    return win.API_1484_11 || null;
  }

  _init() {
    this._api = this._findAPI(window);
    if (!this._api) {
      console.warn('[SCORM] No SCORM 2004 API found — running in standalone mode.');
      return;
    }
    const result = this._api.Initialize('');
    this._ready  = result === 'true' || result === true;
    if (this._ready) {
      this._api.SetValue('cmi.completion_status', 'incomplete');
      this._api.SetValue('cmi.success_status',    'unknown');
      this._api.Commit('');
      console.log('[SCORM] Initialized successfully (SCORM 2004).');
    }
  }

  setProgress(visitedIds) {
    if (!this._ready) return;
    const data = JSON.stringify({ visited: Array.from(visitedIds), ts: Date.now() });
    this._api.SetValue('cmi.suspend_data', data.substring(0, 4096));
    this._api.Commit('');
  }

  setScore(score) {
    if (!this._ready) return;
    this._api.SetValue('cmi.score.scaled', String(score / 100));
    this._api.SetValue('cmi.score.raw',    String(score));
    this._api.Commit('');
  }

  complete(score) {
    if (!this._ready) {
      console.log(`[SCORM] Standalone — score: ${score}%, ${score >= 70 ? 'PASSED' : 'FAILED'}`);
      return;
    }
    const passed = score >= 70;
    this._api.SetValue('cmi.completion_status', 'completed');
    this._api.SetValue('cmi.success_status',    passed ? 'passed' : 'failed');
    this._api.SetValue('cmi.score.scaled',       String(score / 100));
    this._api.SetValue('cmi.score.raw',          String(score));
    this._api.SetValue('cmi.score.min',          '0');
    this._api.SetValue('cmi.score.max',          '100');
    this._api.Commit('');
    this._api.Terminate('');
    console.log(`[SCORM] Completed — Score: ${score}%, Status: ${passed ? 'PASSED' : 'FAILED'}`);
  }
}

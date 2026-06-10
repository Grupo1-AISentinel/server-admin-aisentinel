'use strict';

import AlertPreference, {
  EMAIL_STRATEGIES,
  REPORT_FORMATS,
  STUDENT_NOTIFY_MODES,
  REPORT_DAYS,
} from './preference.model.js';

const DEFAULTS = {
  emailStrategy: 'per_cycle',
  reportTime: '18:00',
  reportDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  minInfractions: 1,
  reportFormat: 'pdf',
  immediateCritical: true,
  immediateThreshold: 5,
  studentNotify: 'first_only',
};

const isValidTime = (t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

const sanitizeInput = (body) => {
  const out = {};
  if (body.emailStrategy && EMAIL_STRATEGIES.includes(body.emailStrategy)) {
    out.emailStrategy = body.emailStrategy;
  }
  if (isValidTime(body.reportTime)) {
    out.reportTime = body.reportTime;
  }
  if (Array.isArray(body.reportDays)) {
    const filtered = body.reportDays.filter((d) => REPORT_DAYS.includes(d));
    if (filtered.length > 0) out.reportDays = filtered;
  }
  if (Number.isFinite(body.minInfractions) && body.minInfractions >= 1) {
    out.minInfractions = body.minInfractions;
  }
  if (body.reportFormat && REPORT_FORMATS.includes(body.reportFormat)) {
    out.reportFormat = body.reportFormat;
  }
  if (typeof body.immediateCritical === 'boolean') {
    out.immediateCritical = body.immediateCritical;
  }
  if (Number.isFinite(body.immediateThreshold) && body.immediateThreshold >= 1) {
    out.immediateThreshold = body.immediateThreshold;
  }
  if (body.studentNotify && STUDENT_NOTIFY_MODES.includes(body.studentNotify)) {
    out.studentNotify = body.studentNotify;
  }
  return out;
};

export const getMyPreferences = async (req, res) => {
  try {
    const userId = req.userId;
    const role = req.userRole;
    const pref = await AlertPreference.findOne({ userId }).lean();
    if (pref) {
      return res.status(200).json({ success: true, preferences: pref, defaults: DEFAULTS });
    }
    return res
      .status(200)
      .json({ success: true, preferences: { userId, role, ...DEFAULTS }, defaults: DEFAULTS });
  } catch (err) {
    console.error('[preferences] getMyPreferences:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener preferencias' });
  }
};

export const upsertMyPreferences = async (req, res) => {
  try {
    const userId = req.userId;
    const role = req.userRole;
    const sanitized = sanitizeInput(req.body);
    const pref = await AlertPreference.findOneAndUpdate(
      { userId },
      { $set: { ...sanitized, userId, role } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json({ success: true, preferences: pref });
  } catch (err) {
    console.error('[preferences] upsertMyPreferences:', err);
    return res.status(500).json({ success: false, message: 'Error al guardar preferencias' });
  }
};

export const getPreferencesForUser = async (userId) => {
  const pref = await AlertPreference.findOne({ userId }).lean();
  if (pref) return pref;
  return { userId, role: null, ...DEFAULTS };
};

'use strict';

import schedule from 'node-schedule';
import AlertPreference from '../src/preferences/preference.model.js';
import Alert from '../src/alerts/alerts.model.js';
import Student from '../src/students/student.model.js';
import Coordinator from '../src/coordinator/coordinator.model.js';
import { generateDailyReportPdf } from './daily-report-pdf.js';
import { sendEmailWithAttachment } from './email-generator.js';

const DAY_MAP = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const enrichInfractions = async (rows) => {
  if (rows.length === 0) return [];
  const cards = [...new Set(rows.map((r) => r.studentCard).filter(Boolean))];
  const students = await Student.find({ idCard: { $in: cards } })
    .select('idCard studentName studentSurname grade')
    .lean();
  const map = new Map(students.map((s) => [s.idCard, s]));
  return rows.map((r) => {
    const s = map.get(r.studentCard);
    return {
      ...r,
      studentName: s?.studentName || '',
      studentSurname: s?.studentSurname || '',
      grade: s?.grade || null,
    };
  });
};

const fetchInfractionsForGrade = async (grade) => {
  const since = startOfDay();
  const alerts = await Alert.find({
    lastDetection: { $gte: since },
    studentCard: { $exists: true, $ne: null },
  }).lean();
  if (alerts.length === 0) return [];
  const cards = [...new Set(alerts.map((a) => a.studentCard))];
  const students = await Student.find({ idCard: { $in: cards }, grade, isActive: true })
    .select('idCard')
    .lean();
  const validCards = new Set(students.map((s) => s.idCard));
  const filtered = alerts.filter((a) => validCards.has(a.studentCard));
  return enrichInfractions(filtered);
};

const sendReport = async (preference) => {
  try {
    const coordinator = await Coordinator.findOne({ authUserId: preference.userId, isActive: true })
      .select('email firstName lastName grade')
      .lean();
    if (!coordinator || !coordinator.email) {
      console.log(`[daily-report] sin email para userId=${preference.userId}`);
      return;
    }

    const minInfractions = preference.minInfractions || 1;
    const infractions = await fetchInfractionsForGrade(coordinator.grade);
    if (infractions.length < minInfractions) {
      console.log(
        `[daily-report] userId=${preference.userId} grado=${coordinator.grade} skipped (${infractions.length} < ${minInfractions})`
      );
      return;
    }

    const pdfBuffer = await generateDailyReportPdf({
      coordinatorName: `${coordinator.firstName} ${coordinator.lastName}`.trim(),
      grade: coordinator.grade,
      infractions,
      generatedAt: new Date(),
    });

    const today = new Date().toISOString().slice(0, 10);
    const subject = `Reporte de infracciones - ${today}`;
    const html = `
      <p>Estimado(a) ${coordinator.firstName} ${coordinator.lastName},</p>
      <p>Adjunto encontrará el reporte consolidado de infracciones de uniforme correspondientes al día de hoy (${today}) para el grado <strong>${coordinator.grade}</strong>.</p>
      <p>Total de infracciones registradas: <strong>${infractions.length}</strong></p>
      <p>Este correo fue generado automáticamente según sus preferencias de notificación.</p>
    `;

    await sendEmailWithAttachment(
      coordinator.email,
      subject,
      html,
      pdfBuffer,
      `reporte-infracciones-${today}.pdf`
    );
    console.log(
      `[daily-report] enviado a ${coordinator.email} grado=${coordinator.grade} (${infractions.length} infracciones)`
    );
  } catch (err) {
    console.error(`[daily-report] error userId=${preference.userId}: ${err.message}`);
  }
};

const processTick = async () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`;
  const currentDay = DAY_MAP[now.getDay()];

  const prefs = await AlertPreference.find({
    emailStrategy: 'daily_report',
    reportTime: currentTime,
    reportDays: currentDay,
  }).lean();

  if (prefs.length === 0) return;
  console.log(`[daily-report] tick: ${prefs.length} destinatario(s) a las ${currentTime} ${currentDay}`);

  for (const pref of prefs) {
    await sendReport(pref);
    await new Promise((r) => setTimeout(r, 2000));
  }
};

let scheduled = null;

export const startDailyReportScheduler = () => {
  if (scheduled) return scheduled;
  scheduled = schedule.scheduleJob('* * * * *', processTick);
  console.log('[daily-report] scheduler iniciado (cada minuto)');
  return scheduled;
};

export const stopDailyReportScheduler = () => {
  if (scheduled) {
    scheduled.cancel();
    scheduled = null;
  }
};

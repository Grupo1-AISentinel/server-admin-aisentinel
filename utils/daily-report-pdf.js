'use strict';

import puppeteer from 'puppeteer';

const formatDate = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('es-GT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatReason = (reason) => {
  if (reason === 'UNIFORME_INCOMPLETO') return 'Uniforme incompleto';
  if (reason === 'ACCESORIO_NO_PERMITIDO') return 'Accesorio no permitido';
  return reason || '—';
};

const escape = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildHtml = ({ coordinatorName, grade, infractions, generatedAt }) => {
  const total = infractions.length;
  const byReason = infractions.reduce((acc, inf) => {
    const key = inf.reason || 'OTRO';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const rows = infractions
    .map(
      (inf) => `
        <tr>
          <td>${formatDate(inf.lastDetection || inf.createdAt)}</td>
          <td>${escape(inf.studentCard || '—')}</td>
          <td>${escape(inf.studentName || '')}</td>
          <td>${escape(inf.studentSurname || '')}</td>
          <td>${escape(inf.grade || '—')}</td>
          <td><span class="reason reason-${escape((inf.reason || '').toLowerCase())}">${escape(formatReason(inf.reason))}</span></td>
          <td>${inf.infractionCount || 1}</td>
        </tr>
      `
    )
    .join('');

  return `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 0; font-size: 11px; }
        .page { padding: 24px; }
        .header { border-bottom: 3px solid #ebc246; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 24px; font-weight: 700; color: #1a1a1a; }
        .logo .accent { color: #ebc246; }
        .meta { text-align: right; color: #6b6b6b; font-size: 11px; }
        h1 { font-size: 20px; margin: 0 0 4px 0; color: #1a1a1a; }
        h2 { font-size: 14px; margin: 24px 0 8px 0; color: #1a1a1a; }
        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat { background: #f5f5f5; padding: 12px; border-radius: 6px; border-left: 3px solid #ebc246; }
        .stat .label { font-size: 10px; color: #6b6b6b; text-transform: uppercase; letter-spacing: 0.5px; }
        .stat .value { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th { background: #1a1a1a; color: #fff; text-align: left; padding: 8px 6px; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 6px; border-bottom: 1px solid #e5e5e5; }
        tr:nth-child(even) td { background: #fafafa; }
        .reason { padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; text-transform: uppercase; }
        .reason-uniforme_incompleto { background: #fff4d6; color: #8a6d00; }
        .reason-accesorio_no_permitido { background: #ffd6d6; color: #a00; }
        .empty { text-align: center; color: #6b6b6b; padding: 24px; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; color: #6b6b6b; font-size: 10px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div>
            <div class="logo">AI <span class="accent">Sentinel</span></div>
            <h1>Reporte diario de infracciones</h1>
            <div style="color:#6b6b6b;">Coordinador: <strong>${escape(coordinatorName || '—')}</strong>${grade ? ` · Grado: <strong>${escape(grade)}</strong>` : ''}</div>
          </div>
          <div class="meta">
            Generado el<br />${formatDate(generatedAt)}
          </div>
        </div>

        <h2>Resumen</h2>
        <div class="summary">
          <div class="stat">
            <div class="label">Total infracciones</div>
            <div class="value">${total}</div>
          </div>
          <div class="stat">
            <div class="label">Uniforme incompleto</div>
            <div class="value">${byReason.UNIFORME_INCOMPLETO || 0}</div>
          </div>
          <div class="stat">
            <div class="label">Accesorio no permitido</div>
            <div class="value">${byReason.ACCESORIO_NO_PERMITIDO || 0}</div>
          </div>
        </div>

        <h2>Detalle</h2>
        ${
          total === 0
            ? '<div class="empty">No se registraron infracciones en el período.</div>'
            : `<table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Carnet</th>
                  <th>Nombre</th>
                  <th>Apellido</th>
                  <th>Grado</th>
                  <th>Motivo</th>
                  <th>Conteo</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>`
        }

        <div class="footer">
          AI Sentinel · Reporte generado automáticamente · ${formatDate(generatedAt)}
        </div>
      </div>
    </body>
    </html>
  `;
};

export const generateDailyReportPdf = async (data) => {
  const html = buildHtml(data);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '15mm',
        right: '15mm',
      },
    });
    return buffer;
  } finally {
    await browser.close();
  }
};

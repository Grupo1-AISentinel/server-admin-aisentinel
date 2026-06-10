import PDFDocument from 'pdfkit';

const cmToPts = (cm) => cm * 28.3465;

const drawHeaderRow = (doc, headers, colWidths, startX, y, rowHeight, fontSize) => {
  doc.fontSize(fontSize);
  const textOffsetY = (rowHeight - doc.currentLineHeight()) / 2;
  let currentX = startX;
  for (let i = 0; i < headers.length; i += 1) {
    doc.rect(currentX, y, colWidths[i], rowHeight).fill('#4472C4');
    doc
      .fillColor('white')
      .text(headers[i], currentX, y + textOffsetY, { width: colWidths[i], align: 'center' });
    currentX += colWidths[i];
  }
  return y + rowHeight;
};

export const generateStatsPDFBuffer = (title, headers, colWidthsCm, rows) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      doc
        .fillColor('black')
        .fontSize(24)
        .text('AISentinel – Reporte de estadísticas', { align: 'center' })
        .moveDown(0.5);

      doc
        .fillColor('#2F5496')
        .fontSize(18)
        .text(title, { align: 'center' })
        .moveDown(1.5);

      const usableWidth = doc.page.width - 2 * doc.page.margins.left;
      const rawWidths = colWidthsCm.map(cmToPts);
      const totalRaw = rawWidths.reduce((a, b) => a + b, 0);
      const scale = totalRaw > usableWidth ? usableWidth / totalRaw : 1;
      const colWidths = rawWidths.map((w) => w * scale);
      const totalWidth = colWidths.reduce((a, b) => a + b, 0);
      const startX = (doc.page.width - totalWidth) / 2;

      const fontSize = scale < 0.8 ? 9 : scale < 0.95 ? 11 : 14;
      const rowHeight = cmToPts(0.9);
      const bottomLimit = doc.page.height - 70;

      let currentY = drawHeaderRow(doc, headers, colWidths, startX, doc.y, rowHeight, fontSize);

      for (let r = 0; r < rows.length; r += 1) {
        if (currentY + rowHeight > bottomLimit) {
          doc.addPage();
          currentY = 50;
          currentY = drawHeaderRow(doc, headers, colWidths, startX, currentY, rowHeight, fontSize);
        }
        const row = rows[r];
        const bgColor = r % 2 === 0 ? '#EAEFFF' : '#FFFFFF';
        doc.fontSize(fontSize);
        const textOffsetY = (rowHeight - doc.currentLineHeight()) / 2;
        let currentX = startX;
        for (let c = 0; c < row.length; c += 1) {
          const isFirstCol = c === 0;
          const cellBg = isFirstCol ? '#4472C4' : bgColor;
          const textColor = isFirstCol ? 'white' : 'black';
          doc.rect(currentX, currentY, colWidths[c], rowHeight).fill(cellBg);
          doc
            .fillColor(textColor)
            .text(String(row[c]), currentX, currentY + textOffsetY, {
              width: colWidths[c],
              align: 'center',
            });
          currentX += colWidths[c];
        }
        currentY += rowHeight;
      }

      doc
        .fillColor('black')
        .fontSize(10)
        .text(
          `Generado el: ${new Date().toLocaleString()}`,
          50,
          doc.page.height - 50,
          { align: 'center', width: doc.page.width - 100 }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

import PDFDocument from 'pdfkit';

const cmToPts = (cm) => cm * 28.3465;

export const generateStatsPDFBuffer = (title, headers, colWidthsCm, rows) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                resolve(Buffer.concat(buffers));
            });

            // Título principal
            doc.fillColor('black')
               .fontSize(24)
               .text('AISentinel – Reporte de estadísticas', { align: 'center' })
               .moveDown(0.5);

            // Subtítulo en azul
            doc.fillColor('#2F5496')
               .fontSize(18)
               .text(title, { align: 'center' })
               .moveDown(2);

            // Configuración de dimensiones de la tabla
            const colWidths = colWidthsCm.map(cmToPts);
            const totalWidth = colWidths.reduce((a, b) => a + b, 0);
            const startX = (doc.page.width - totalWidth) / 2; // Centrado
            let currentY = doc.y;
            const rowHeight = cmToPts(1); // 1 cm de altura

            doc.fontSize(14);
            // Cálculo para centrar el texto verticalmente en la celda
            const textOffsetY = (rowHeight - doc.currentLineHeight()) / 2;

            // Dibujar Cabeceras
            let currentX = startX;
            for(let i = 0; i < headers.length; i++) {
                doc.rect(currentX, currentY, colWidths[i], rowHeight).fill('#4472C4');
                doc.fillColor('white').text(headers[i], currentX, currentY + textOffsetY, {
                    width: colWidths[i],
                    align: 'center'
                });
                currentX += colWidths[i];
            }
            currentY += rowHeight;

            // Dibujar Filas de datos
            for(let r = 0; r < rows.length; r++) {
                const row = rows[r];
                // Alternar colores de fondo (blanco y celeste muy claro)
                const bgColor = r % 2 === 0 ? '#EAEFFF' : '#FFFFFF';

                currentX = startX;
                for(let c = 0; c < row.length; c++) {
                    const isFirstCol = c === 0;
                    const cellBgColor = isFirstCol ? '#4472C4' : bgColor;
                    const textColor = isFirstCol ? 'white' : 'black';

                    // Fondo de la celda
                    doc.rect(currentX, currentY, colWidths[c], rowHeight).fill(cellBgColor);
                    
                    // Texto de la celda
                    doc.fillColor(textColor).text(String(row[c]), currentX, currentY + textOffsetY, {
                        width: colWidths[c],
                        align: 'center'
                    });
                    currentX += colWidths[c];
                }
                currentY += rowHeight;
            }

            // Fecha de generación
            doc.fillColor('black')
               .fontSize(14)
               .text(`Generado el: ${new Date().toLocaleString()}`, 50, doc.page.height - 100, { align: 'center' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};
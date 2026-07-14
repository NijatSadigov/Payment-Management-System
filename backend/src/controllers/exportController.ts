import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';
import { buildCustomerWhere } from '../lib/customerFilter';
import { round2 } from '../lib/payment';

function money(n: number): string {
  return `${round2(n).toFixed(2)} AZN`;
}

async function fetchRows(req: Request) {
  const where = await buildCustomerWhere(req.user!, req.query);
  return prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { campaign: true },
  });
}

export async function exportExcel(req: Request, res: Response) {
  const customers = await fetchRows(req);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Payment Management System';
  const ws = wb.addWorksheet('Customers');

  ws.columns = [
    { header: 'Name', key: 'firstName', width: 16 },
    { header: 'Surname', key: 'lastName', width: 16 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Campaign', key: 'campaign', width: 22 },
    { header: 'Plan', key: 'plan', width: 10 },
    { header: 'Total', key: 'total', width: 14 },
    { header: 'Paid', key: 'paid', width: 14 },
    { header: 'Remaining', key: 'remaining', width: 14 },
    { header: 'Last Payment', key: 'last', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  for (const c of customers) {
    ws.addRow({
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      campaign: c.campaign?.name ?? '',
      plan: c.paymentPlan,
      total: money(c.totalAmount),
      paid: money(c.amountPaid),
      remaining: money(c.remainingDebt),
      last: c.lastPaymentDate ? new Date(c.lastPaymentDate).toLocaleString() : '—',
      status: c.status === 'paid' ? 'Paid' : 'Has Debt',
    });
  }

  // Totals row.
  const totalPaid = customers.reduce((s, c) => s + c.amountPaid, 0);
  const totalDebt = customers.reduce((s, c) => s + c.remainingDebt, 0);
  const totalsRow = ws.addRow({
    firstName: 'TOTALS',
    paid: money(totalPaid),
    remaining: money(totalDebt),
  });
  totalsRow.font = { bold: true };

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', 'attachment; filename="customers.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

export async function exportPdf(req: Request, res: Response) {
  const customers = await fetchRows(req);

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="customers.pdf"');
  doc.pipe(res);

  doc.fontSize(18).fillColor('#1e293b').text('Payment Management System — Customer Report');
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#64748b').text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown(0.8);

  const cols = [
    { label: 'Name', width: 90 },
    { label: 'Phone', width: 90 },
    { label: 'Campaign', width: 120 },
    { label: 'Plan', width: 45 },
    { label: 'Total', width: 80 },
    { label: 'Paid', width: 80 },
    { label: 'Remaining', width: 80 },
    { label: 'Status', width: 70 },
  ];
  const startX = doc.page.margins.left;

  function drawRow(cells: string[], y: number, bold: boolean, color = '#1e293b') {
    let x = startX;
    doc.fontSize(9).fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    cells.forEach((cell, i) => {
      doc.text(cell, x + 2, y, { width: cols[i].width - 4, ellipsis: true });
      x += cols[i].width;
    });
  }

  let y = doc.y;
  // Header background.
  const tableWidth = cols.reduce((s, c) => s + c.width, 0);
  doc.rect(startX, y - 2, tableWidth, 16).fill('#1e293b');
  drawRow(
    cols.map((c) => c.label),
    y,
    true,
    '#ffffff',
  );
  y += 18;

  for (const c of customers) {
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    drawRow(
      [
        `${c.firstName} ${c.lastName}`,
        c.phone,
        c.campaign?.name ?? '',
        c.paymentPlan,
        money(c.totalAmount),
        money(c.amountPaid),
        money(c.remainingDebt),
        c.status === 'paid' ? 'Paid' : 'Has Debt',
      ],
      y,
      false,
    );
    y += 16;
  }

  const totalPaid = customers.reduce((s, c) => s + c.amountPaid, 0);
  const totalDebt = customers.reduce((s, c) => s + c.remainingDebt, 0);
  y += 6;
  drawRow(
    ['TOTALS', '', '', '', '', money(totalPaid), money(totalDebt), ''],
    y,
    true,
  );

  doc.end();
}

/**
 * PDF Generator for Delivery OS (Herculano Gestor)
 * Generates professional official PDFs for Shift Closings and Reports.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CompanySettings, ShiftClosing, DeliveryOrder, Motoboy, DeliveryStore } from '../types';
import { formatCurrency, formatDate, formatDateTime, maskCpfRedacted } from '../utils/formatters';

interface BaseReportOptions {
  company: CompanySettings;
  operatorName: string;
}

export function generateShiftClosingPdf(
  closing: ShiftClosing,
  orders: DeliveryOrder[],
  company: CompanySettings,
  operatorName: string
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 14;

  // Header Background bar
  doc.setFillColor(11, 25, 44); // #0B192C (Delivery OS Navy)
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Accent Orange Line
  doc.setFillColor(255, 101, 0); // #FF6500
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Header Title & Ecosystem
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVERY OS — CONTROLE INTELIGENTE DE ENTREGAS', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 230);
  doc.text(`Ecossistema Herculano Gestor  |  Fechamento de Turno: ${closing.closingCode}`, 14, 18);
  doc.text(`Emissão: ${formatDateTime(new Date())} por ${operatorName}`, 14, 23);

  currentY = 36;

  // Company Identity Box
  doc.setDrawColor(220, 225, 235);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, pageWidth - 28, 20, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(company.tradeName || 'EMPRESA ADMINISTRADORA', 18, currentY + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const companySub = `CNPJ: ${company.cnpj || 'Não informado'}  |  Tel: ${company.phone || 'Não informado'}  |  E-mail: ${company.email || ''}`;
  doc.text(companySub, 18, currentY + 12);
  const addressSub = `${company.address || ''}, ${company.number || ''} ${company.neighborhood || ''} - ${company.city || ''}/${company.state || ''}`;
  doc.text(addressSub, 18, currentY + 16);

  currentY += 26;

  // Shift Highlights Grid
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 25, 44);
  doc.text('RESUMO OPERACIONAL DO TURNO', 14, currentY);
  currentY += 4;

  const boxW = (pageWidth - 28 - 9) / 4;
  const metrics = [
    { label: 'Total Corridas', val: String(closing.totalOrders), color: [30, 41, 59] },
    { label: 'Entregas Concluídas', val: String(closing.completedOrders), color: [22, 163, 74] },
    { label: 'Canceladas / Não Enc.', val: `${closing.canceledOrders + closing.clientNotFoundOrders}`, color: [220, 38, 38] },
    { label: 'Total Financeiro', val: formatCurrency(closing.totalFinancialAmount), color: [255, 101, 0] },
  ];

  metrics.forEach((m, idx) => {
    const x = 14 + idx * (boxW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, boxW, 16, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, x + 3, currentY + 5.5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, x + 3, currentY + 12);
  });

  currentY += 22;

  // Motoboy Breakdown Table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 25, 44);
  doc.text('REPASSE E RANKING DE MOTOBOYS NO TURNO', 14, currentY);

  const motoboyRows = closing.motoboysSummary.map((mb, i) => [
    `${i + 1}º`,
    mb.motoboyName,
    String(mb.completedCount),
    formatCurrency(mb.totalAmount),
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Pos.', 'Motoboy', 'Entregas Concluídas', 'Total Financeiro']],
    body: motoboyRows.length > 0 ? motoboyRows : [['-', 'Nenhuma entrega realizada', '0', 'R$ 0,00']],
    theme: 'grid',
    headStyles: {
      fillColor: [11, 25, 44],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Table of orders
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 25, 44);
  doc.text('LISTAGEM DE CORRIDAS DO TURNO', 14, currentY);

  const orderRows = orders.map((ord) => {
    let statusLabel = 'Pendente';
    if (ord.status === 'completed') statusLabel = 'Concluída';
    if (ord.status === 'canceled') statusLabel = 'Cancelada';
    if (ord.status === 'client_not_found') statusLabel = 'Não Encontrado';

    return [
      ord.orderNumber,
      ord.dispatchTime,
      ord.storeName,
      ord.clientName,
      ord.neighborhood,
      ord.motoboyName,
      formatCurrency(ord.rate),
      statusLabel,
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Pedido', 'Hora', 'Loja', 'Cliente', 'Bairro', 'Motoboy', 'Valor', 'Status']],
    body: orderRows,
    theme: 'striped',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
    },
    margin: { left: 14, right: 14 },
  });

  // Signatures on last page
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 14;
  if (currentY > 250) {
    doc.addPage();
    currentY = 25;
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(20, currentY + 12, 85, currentY + 12);
  doc.line(pageWidth - 85, currentY + 12, pageWidth - 20, currentY + 12);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Operador Responsável', 35, currentY + 16);
  doc.text('Coordenação / Gerência', pageWidth - 70, currentY + 16);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Delivery OS — Herculano Gestor | Página ${i} de ${totalPages} | Documento Oficial Auditado`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  doc.save(`Fechamento_Turno_${closing.closingCode}.pdf`);
}

export function generateMotoboyReportPdf(
  motoboy: Motoboy,
  orders: DeliveryOrder[],
  periodLabel: string,
  company: CompanySettings,
  operatorName: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 14;

  // Header bar
  doc.setFillColor(11, 25, 44);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(255, 101, 0);
  doc.rect(0, 28, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVERY OS — DEMONSTRATIVO INDIVIDUAL POR MOTOBOY', 14, 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 230);
  doc.text(`Período de Referência: ${periodLabel}`, 14, 18);
  doc.text(`Emissão: ${formatDateTime(new Date())} por ${operatorName}`, 14, 23);

  currentY = 36;

  // Courier Card Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Motoboy: ${motoboy.name}`, 18, currentY + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`CPF: ${maskCpfRedacted(motoboy.cpf)}  |  Telefone: ${motoboy.phone}  |  Status: ${motoboy.active ? 'Ativo' : 'Inativo'}`, 18, currentY + 12);
  doc.text(`Empresa Administradora: ${company.tradeName} (CNPJ: ${company.cnpj})`, 18, currentY + 17);

  currentY += 28;

  // Metric summaries for this motoboy
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const canceledOrders = orders.filter((o) => o.status === 'canceled');
  const notFoundOrders = orders.filter((o) => o.status === 'client_not_found');
  const totalFinancial = completedOrders.reduce((acc, curr) => acc + curr.rate, 0);

  const boxW = (pageWidth - 28 - 9) / 4;
  const metrics = [
    { label: 'Total Corridas', val: String(orders.length), color: [30, 41, 59] },
    { label: 'Entregas Concluídas', val: String(completedOrders.length), color: [22, 163, 74] },
    { label: 'Canceladas / Não Enc.', val: `${canceledOrders.length + notFoundOrders.length}`, color: [220, 38, 38] },
    { label: 'Total a Repassar', val: formatCurrency(totalFinancial), color: [255, 101, 0] },
  ];

  metrics.forEach((m, idx) => {
    const x = 14 + idx * (boxW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, currentY, boxW, 16, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, x + 3, currentY + 5.5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(m.color[0], m.color[1], m.color[2]);
    doc.text(m.val, x + 3, currentY + 12);
  });

  currentY += 22;

  // Breakdown by store for this courier
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 25, 44);
  doc.text('RESUMO DE ENTREGAS POR LOJA DE ORIGEM', 14, currentY);

  const storeMap: Record<string, { count: number; amount: number }> = {};
  completedOrders.forEach((o) => {
    if (!storeMap[o.storeName]) storeMap[o.storeName] = { count: 0, amount: 0 };
    storeMap[o.storeName].count += 1;
    storeMap[o.storeName].amount += o.rate;
  });

  const storeRows = Object.entries(storeMap).map(([sName, data]) => [
    sName,
    String(data.count),
    formatCurrency(data.amount),
  ]);

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Loja / Empresa de Origem', 'Entregas Concluídas', 'Valor Acumulado']],
    body: storeRows.length > 0 ? storeRows : [['Sem entregas no período', '0', 'R$ 0,00']],
    theme: 'grid',
    headStyles: { fillColor: [11, 25, 44], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  // Table of all deliveries
  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 25, 44);
  doc.text('EXTRATO DETALHADO DE CORRIDAS', 14, currentY);

  const orderRows = orders.map((o) => {
    let st = 'Pendente';
    if (o.status === 'completed') st = 'Concluída';
    if (o.status === 'canceled') st = 'Cancelada';
    if (o.status === 'client_not_found') st = 'Não Encontrado';

    return [
      formatDate(o.operationalDate),
      o.orderNumber,
      o.storeName,
      o.neighborhood,
      formatCurrency(o.rate),
      st,
    ];
  });

  autoTable(doc, {
    startY: currentY + 3,
    head: [['Data', 'Pedido', 'Loja', 'Bairro', 'Valor', 'Status']],
    body: orderRows,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 7.5 },
    styles: { fontSize: 7, cellPadding: 1.8 },
    margin: { left: 14, right: 14 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Delivery OS — Herculano Gestor | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  doc.save(`Relatorio_Motoboy_${motoboy.name.replace(/\s+/g, '_')}.pdf`);
}

export function generateStoreReportPdf(
  stores: DeliveryStore[],
  orders: DeliveryOrder[],
  periodLabel: string,
  company: CompanySettings,
  operatorName: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 14;

  // Header bar
  doc.setFillColor(11, 25, 44);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(255, 101, 0);
  doc.rect(0, 28, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVERY OS — RELATÓRIO POR EMPRESAS / LOJAS DE ENTREGA', 14, 12);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 220, 230);
  doc.text(`Período: ${periodLabel}  |  Emissão: ${formatDateTime(new Date())} por ${operatorName}`, 14, 18);
  doc.text(`Administradora: ${company.tradeName} (CNPJ: ${company.cnpj})`, 14, 23);

  currentY = 36;

  // Breakdown per store table
  const tableRows: any[] = [];
  let grandTotalOrders = 0;
  let grandCompleted = 0;
  let grandCanceled = 0;
  let grandNotFound = 0;
  let grandFinancial = 0;

  stores.forEach((st) => {
    const storeOrders = orders.filter((o) => o.storeId === st.id);
    const completed = storeOrders.filter((o) => o.status === 'completed');
    const canceled = storeOrders.filter((o) => o.status === 'canceled');
    const notFound = storeOrders.filter((o) => o.status === 'client_not_found');
    const financial = completed.reduce((acc, curr) => acc + curr.rate, 0);

    grandTotalOrders += storeOrders.length;
    grandCompleted += completed.length;
    grandCanceled += canceled.length;
    grandNotFound += notFound.length;
    grandFinancial += financial;

    tableRows.push([
      st.name,
      String(storeOrders.length),
      String(completed.length),
      String(canceled.length),
      String(notFound.length),
      formatCurrency(financial),
    ]);
  });

  tableRows.push([
    'TOTAL GERAL CONSOLIDADO',
    String(grandTotalOrders),
    String(grandCompleted),
    String(grandCanceled),
    String(grandNotFound),
    formatCurrency(grandFinancial),
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Empresa / Loja', 'Total', 'Concluídas', 'Canceladas', 'Não Enc.', 'Total Financeiro']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [11, 25, 44], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.2 },
    margin: { left: 14, right: 14 },
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Delivery OS — Herculano Gestor | Página ${i} de ${totalPages}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    );
  }

  doc.save(`Relatorio_Empresas_Entrega_${periodLabel.replace(/\s+/g, '_')}.pdf`);
}

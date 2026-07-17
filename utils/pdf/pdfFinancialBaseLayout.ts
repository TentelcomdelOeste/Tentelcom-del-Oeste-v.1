import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export type PdfHeaderData = {
  title: string
  subtitle: string
  logo?: string
  metaLeft: string[]
  metaRight: string[]
}

export type PdfKPI = {
  label: string
  value: string
  color: [number, number, number]
}

export type PdfTable = {
  title: string
  head: string[][]
  body: any[][]
  columnStyles?: any
}

export type PdfTotals = {
  rows: { label: string; value: string }[]
}

export function renderFinancialBasePDF(params: {
  header: PdfHeaderData
  kpis: PdfKPI[]
  tables: PdfTable[]
  totals?: PdfTotals
}) {
  const doc = new jsPDF()
  const margin = 14
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height

  /* ================= HEADER ================= */
  if (params.header.logo) {
    doc.addImage(
      params.header.logo,
      'PNG',
      pageWidth - margin - 35,
      10,
      35,
      0
    )
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30, 58, 138)
  doc.text(params.header.title, margin, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(params.header.subtitle, margin, 26)

  /* ================= INFO BOX ================= */
  let y = 34
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y, pageWidth - 28, 16, 2, 2, 'FD')

  doc.setLineWidth(0.1)
  doc.line(margin, y + 8, pageWidth - margin, y + 8)

  doc.setFontSize(6)
  doc.setTextColor(148, 163, 184)
  params.header.metaLeft.forEach((t, i) =>
    doc.text(t, 20, y + (i === 0 ? 5.5 : 13.5))
  )
  params.header.metaRight.forEach((t, i) =>
    doc.text(t, pageWidth - 20, y + (i === 0 ? 5.5 : 13.5), {
      align: 'right',
    })
  )

  /* ================= KPI CARDS ================= */
  y += 24
  const cardHeight = 16
  const gap = 3
  const cardWidth = (pageWidth - 28 - gap * 3) / 4

  params.kpis.forEach((kpi, i) => {
    const x = margin + i * (cardWidth + gap)
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, 'FD')

    doc.setDrawColor(...kpi.color)
    doc.setLineWidth(0.5)
    doc.line(x + 2, y + 15.5, x + cardWidth - 2, y + 15.5)

    doc.setFontSize(6)
    doc.setTextColor(148, 163, 184)
    doc.text(kpi.label, x + 4, y + 5.5)

    doc.setFontSize(9)
    doc.setTextColor(...kpi.color)
    doc.text(kpi.value, x + 4, y + 12)
  })

  /* ================= TABLES ================= */
  let lastY = y + 24

  params.tables.forEach((table) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(30, 58, 138)
    doc.text(table.title, margin, lastY);
    autoTable(doc, {
      startY: lastY + 4,
      theme: 'grid',
      head: table.head,
      body: table.body,
      styles: {
        fontSize: 6,
        cellPadding: 1.5,
        textColor: [51, 65, 85],
        lineWidth: 0.1,
        lineColor: [226, 232, 240],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: table.columnStyles,
    })

    lastY = (doc as any).lastAutoTable.finalY + 10
  })

  /* ================= TOTALS ================= */
  if (params.totals) {
    const x = pageWidth - margin - 140
    doc.setDrawColor(30, 58, 138)
    doc.setLineWidth(0.5)
    doc.line(x, lastY, x + 140, lastY);
    autoTable(doc, {
      startY: lastY + 2,
      theme: 'plain',
      tableWidth: 140,
      margin: { left: x },
      body: params.totals.rows.map((r) => [r.label, r.value]),
      styles: {
        fontSize: 8,
        fontStyle: 'bold',
        textColor: [15, 23, 42],
        halign: 'right',
        cellPadding: 1,
      },
    })
  }

  /* ================= FOOTER ================= */
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(
      'Documento generado automáticamente – TENTELCOM DEL OESTE S.A.',
      margin,
      pageHeight - 10
    )
    doc.text(
      `Pág. ${i} de ${pageCount}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    )
  }

  return doc
}
import type { MaterialsOrder, MaterialsOrderItem } from "@/lib/api/materials-orders"

interface PDFData {
  order: MaterialsOrder
  project: {
    name: string
    address: string
    city: string
    state: string
    postal_code: string
    customer_name: string
  }
}

const COMPANY = {
  name: "Coastal Solutions Media",
  tagline: "Professional Drywall & Paint Services",
  phone: "(555) 000-0000",
  email: "info@coastalsolutionsmedia.com",
}

export function generateMaterialsOrderPDF(data: PDFData): string {
  const { order, project } = data
  const items = order.items ?? []
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Group by category
  const categories = ["Drywall", "Paint", "Trim", "Fasteners", "Prep / Misc"]
  const groupedItems: Record<string, MaterialsOrderItem[]> = {}
  for (const cat of categories) {
    groupedItems[cat] = items.filter((i) => i.category === cat)
  }

  const rowsHtml = categories
    .filter((cat) => groupedItems[cat].length > 0)
    .flatMap((cat) => {
      const catItems = groupedItems[cat]
      return catItems.map((item) => {
        const qty = Number(item.quantity).toLocaleString()
        const unitCost = Number(item.unit_cost).toFixed(2)
        const total = Number(item.total_cost).toFixed(2)
        const checked = item.is_ordered ? "☑" : "☐"
        return `
        <tr>
          <td>${item.description}</td>
          <td style="text-align:center">${item.supplier_part_number || "—"}</td>
          <td style="text-align:center">${item.brand || "—"}</td>
          <td style="text-align:center">${checked}</td>
          <td style="text-align:right">${qty}</td>
          <td style="text-align:center">${item.unit}</td>
          <td style="text-align:right">$${unitCost}</td>
          <td style="text-align:right">$${total}</td>
        </tr>`
      })
    })
    .join("")

  const subtotal = Number(order.subtotal).toFixed(2)
  const tax = Number(order.tax_amount).toFixed(2)
  const total = Number(order.total).toFixed(2)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Materials Order — ${project.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a2e; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #00d4ff; padding-bottom: 20px; margin-bottom: 24px; }
  .company h1 { font-size: 22px; font-weight: 800; color: #0a0e1a; letter-spacing: -0.5px; }
  .company p { font-size: 11px; color: #666; margin-top: 3px; }
  .company .contact { margin-top: 8px; font-size: 11px; color: #444; }
  .header-right { text-align: right; }
  .header-right h2 { font-size: 16px; font-weight: 700; color: #00d4ff; margin-bottom: 4px; }
  .header-right p { font-size: 11px; color: #666; }
  .job-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; background: #f8f9fc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px 20px; }
  .job-info-block h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #00d4ff; margin-bottom: 6px; }
  .job-info-block p { font-size: 13px; color: #1a1a2e; font-weight: 500; line-height: 1.5; }
  .job-info-block p.small { font-size: 11px; color: #666; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
  thead tr { background: #0a0e1a; }
  thead th { color: white; font-weight: 600; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  thead th:nth-child(1) { width: 30%; }
  thead th:not(:first-child):not(:nth-child(2)):not(:nth-child(3)):not(:nth-child(4)) { text-align: right; }
  tbody tr { border-bottom: 1px solid #f0f0f5; }
  tbody tr:hover { background: #f8f9fc; }
  tbody td { padding: 9px 12px; color: #1a1a2e; vertical-align: top; }
  tbody td:first-child { font-weight: 500; }
  .cat-row td { background: #f0f4f8; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #00d4ff; padding: 6px 12px; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-table { width: 280px; }
  .totals-table .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f5; font-size: 13px; }
  .totals-table .row.grand { border-top: 2px solid #0a0e1a; border-bottom: none; font-weight: 800; font-size: 16px; padding-top: 10px; color: #00d4ff; }
  .totals-table .label { color: #666; }
  .totals-table .value { font-weight: 600; color: #1a1a2e; }
  .totals-table .value.accent { color: #00d4ff; }
  .notes { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px 20px; margin-top: 24px; }
  .notes h3 { font-size: 12px; font-weight: 700; color: #92400e; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
  .notes p { font-size: 12px; color: #78350f; line-height: 1.6; white-space: pre-wrap; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #999; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<!-- Header -->
<div class="header">
  <div class="company">
    <h1>${COMPANY.name}</h1>
    <p>${COMPANY.tagline}</p>
    <div class="contact">
      <p>${COMPANY.phone} &nbsp;|&nbsp; ${COMPANY.email}</p>
    </div>
  </div>
  <div class="header-right">
    <h2>MATERIALS ORDER</h2>
    <p>Order Date: ${today}</p>
    <p>Order #: MO-${order.id.slice(0, 8).toUpperCase()}</p>
    <p>Version: ${order.version}</p>
    <p>Status: ${order.status.toUpperCase()}</p>
  </div>
</div>

<!-- Job Info -->
<div class="job-info">
  <div class="job-info-block">
    <h3>Job / Project</h3>
    <p>${project.name}</p>
  </div>
  <div class="job-info-block">
    <h3>Job Address</h3>
    <p>${project.address}</p>
    <p class="small">${project.city}, ${project.state} ${project.postal_code}</p>
  </div>
  <div class="job-info-block">
    <h3>Customer</h3>
    <p>${project.customer_name}</p>
  </div>
  <div class="job-info-block">
    <h3>Notes</h3>
    <p>${order.notes || "—"}</p>
  </div>
</div>

<!-- Line Items Table -->
<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Part #</th>
      <th>Brand</th>
      <th>Ord.</th>
      <th>Qty</th>
      <th>Unit</th>
      <th>Unit Price</th>
      <th>Total</th>
    </tr>
  </thead>
  <tbody>
    ${categories
      .filter((cat) => groupedItems[cat].length > 0)
      .map((cat) => {
        const catItems = groupedItems[cat]
        return `<tr class="cat-row"><td colspan="8">${cat}</td></tr>` +
          catItems
            .map((item) => {
              const qty = Number(item.quantity).toLocaleString()
              const unitCost = Number(item.unit_cost).toFixed(2)
              const total = Number(item.total_cost).toFixed(2)
              const checked = item.is_ordered ? "☑" : "☐"
              return `<tr>
                <td>${item.description}${item.notes ? `<br><span style="font-size:10px;color:#888;">${item.notes}</span>` : ""}</td>
                <td style="text-align:center;color:#666;">${item.supplier_part_number || "—"}</td>
                <td style="text-align:center;color:#666;">${item.brand || "—"}</td>
                <td style="text-align:center;font-size:14px;">${checked}</td>
                <td style="text-align:right;font-weight:600;">${qty}</td>
                <td style="text-align:center;">${item.unit}</td>
                <td style="text-align:right;">$${unitCost}</td>
                <td style="text-align:right;font-weight:600;">$${total}</td>
              </tr>`
            })
            .join("")
      })
      .join("")}
  </tbody>
</table>

<!-- Totals -->
<div class="totals">
  <div class="totals-table">
    <div class="row">
      <span class="label">Subtotal</span>
      <span class="value">$${subtotal}</span>
    </div>
    <div class="row">
      <span class="label">Tax (${Number(order.tax_rate).toFixed(1)}%)</span>
      <span class="value">$${tax}</span>
    </div>
    <div class="row grand">
      <span class="label">Grand Total</span>
      <span class="value accent">$${total}</span>
    </div>
  </div>
</div>

<!-- Notes -->
${order.notes ? `
<div class="notes">
  <h3>Order Notes</h3>
  <p>${order.notes}</p>
</div>
` : ""}

<div class="footer">
  <p>${COMPANY.name} &nbsp;|&nbsp; Materials Order &nbsp;|&nbsp; ${today}</p>
  <p>This is a purchase order for materials. Please verify quantities before ordering.</p>
</div>

</body>
</html>`
}

export function printMaterialsOrder(data: PDFData): void {
  const html = generateMaterialsOrderPDF(data)
  const printWindow = window.open("", "_blank")
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.print()
  }
}

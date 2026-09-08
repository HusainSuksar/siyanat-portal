export function printPurchaseOrder(po: any, vendor?: any, authorizer?: any) {
  const activeVendor = vendor || po.vendor || {};
  const activeAuthorizer = authorizer || po.authorizer || {};

  const printWindow = window.open('', '_blank', 'width=850,height=1050');
  if (!printWindow) return;

  const itemsRows = (po.items || [])
    .map(
      (item: any, idx: number) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">${item.inventory?.name || item.custom_item_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 11px;">${item.requested_qty}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 11px;">₹${(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 11px; font-weight: bold;">₹${((item.requested_qty || 0) * (item.unit_price || 0)).toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Purchase Order - ${po.po_number}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; padding: 40px; margin: 0; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #800000; padding-bottom: 15px; }
          .title { font-size: 20px; font-weight: 900; color: #800000; letter-spacing: 0.5px; }
          .po-meta { text-align: right; font-size: 12px; }
          .section-grid { display: flex; justify-content: space-between; margin: 25px 0; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f8fafc; color: #475569; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 10px; border-bottom: 2px solid #cbd5e1; }
          .totals-table { width: 45%; margin-left: auto; margin-top: 20px; font-size: 12px; }
          .totals-table td { padding: 6px 10px; }
          .grand-total { font-weight: 900; font-size: 14px; color: #800000; border-top: 2px solid #800000; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 15px; border-top: 1px dashed #cbd5e1; font-size: 11px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">AL JAMEA TUS SAIFIYAH</div>
            <div style="font-size: 12px; font-weight: bold; color: #64748b;">Siyanat ul Mumtalekaat (Operations & Logistics)</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Siddhpur Campus, Gujarat</div>
          </div>
          <div class="po-meta">
            <h2 style="margin: 0; color: #800000; font-size: 18px;">PURCHASE ORDER</h2>
            <div style="font-weight: 900; font-size: 15px; margin-top: 4px;">${po.po_number}</div>
            <div><strong>Date:</strong> ${new Date(po.created_at || Date.now()).toLocaleDateString('en-GB')}</div>
            <div style="color: #b91c1c; font-weight: bold; margin-top: 3px;">
              <strong>Expected By:</strong> ${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-GB') : 'Immediate'}
            </div>
          </div>
        </div>

        <div class="section-grid">
          <div>
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 900; color: #94a3b8;">Vendor / Supplier:</span>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px;">${activeVendor.name || 'Authorized Vendor'}</div>
            <div style="color: #475569;">${activeVendor.contact_info || ''}</div>
            <div style="font-size: 11px; color: #64748b;">Category: ${activeVendor.category || 'General'}</div>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 10px; text-transform: uppercase; font-weight: 900; color: #94a3b8;">Commercial Details:</span>
            <div style="margin-top: 2px;"><strong>Payment Terms:</strong> ${po.payment_terms || 'Immediate / COD'}</div>
            <div><strong>Authorized By:</strong> ${activeAuthorizer.full_name || 'Procurement In-Charge'}</div>
            <div><strong>Status:</strong> ${po.status || 'Active'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">#</th>
              <th style="text-align: left;">Item Description</th>
              <th style="width: 70px; text-align: center;">Qty</th>
              <th style="width: 110px; text-align: right;">Rate (₹)</th>
              <th style="width: 120px; text-align: right;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <table class="totals-table">
          <tr>
            <td>Subtotal:</td>
            <td style="text-align: right; font-weight: bold;">₹${(po.subtotal || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>GST / Tax (${po.tax_rate || 0}%):</td>
            <td style="text-align: right; font-weight: bold;">₹${(po.tax_amount || 0).toFixed(2)}</td>
          </tr>
          <tr class="grand-total">
            <td>Total Committed:</td>
            <td style="text-align: right;">₹${(po.total_amount || 0).toFixed(2)}</td>
          </tr>
        </table>

        <div class="footer">
          <div>
            <em>System-generated digital purchase order document.</em>
          </div>
          <div style="text-align: center;">
            <div style="height: 35px;"></div>
            <div style="border-top: 1px solid #94a3b8; padding-top: 5px; font-weight: bold; width: 180px;">Authorized Signatory</div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
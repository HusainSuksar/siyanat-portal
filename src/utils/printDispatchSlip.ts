export const generateDispatchSlip = (batch: any, userRole: string) => {
  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) return alert('Please allow popups to generate the dispatch slip.');

  const deptTitle = userRole === 'AVIT_HEAD' 
    ? 'AVIT DEPARTMENT' 
    : userRole === 'TANZEEM_HEAD' 
      ? 'TANZEEM UL MUMTALEKAAT' 
      : 'SIYANAT UL MUMTALEKAAT';

  const myItems = (batch.items || []).filter(
    (i: any) => userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || i.fulfillment_dept === userRole
  );

  const itemsHtml = myItems.map((item: any, idx: number) => {
    const unitName = (item.inventory && (item.inventory as Record<string, any>).unit) || 'Pcs';
    const itemName = item.custom_item_name || item.inventory?.name || 'Item';
    const itemType = item.item_type || 'Catalog';
    const itemStatus = item.status || 'Allocated';

    return `
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">
          <strong>${itemName}</strong>
          <div style="font-size: 11px; color: #64748b;">Type: ${itemType}</div>
        </td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold; color: #701a28;">
          ${item.requested_qty} ${unitName}
        </td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: center;">
          <span style="font-size: 11px; font-weight: bold; background: #ecfdf5; color: #065f46; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
            ${itemStatus}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Dispatch Slip - ${batch.batch_id}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; }
          .voucher { border: 2px solid #701a28; border-radius: 12px; padding: 24px; max-width: 720px; margin: 0 auto; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .institution { font-size: 18px; font-weight: 900; color: #701a28; letter-spacing: 0.5px; text-transform: uppercase; }
          .dept { font-size: 11px; font-weight: 800; color: #c5a059; text-transform: uppercase; margin-top: 2px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 12px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .meta-val { font-weight: 800; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px; }
          th { background: #701a28; color: #fff; padding: 10px; text-transform: uppercase; font-size: 10px; border: 1px solid #701a28; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
          .sig-box { text-align: center; }
          .sig-line { border-bottom: 1px solid #0f172a; height: 35px; margin-bottom: 6px; }
          .sig-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          @media print { body { padding: 0; } .voucher { border: 1px solid #000; } }
        </style>
      </head>
      <body>
        <div class="voucher">
          <div class="header">
            <div>
              <div class="institution">Al Jamea tus Saifiyah</div>
              <div class="dept">${deptTitle} • Official Gate Pass & Dispatch Slip</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 900; color: #701a28;">${batch.batch_id}</div>
              <div style="font-size: 10px; color: #64748b; font-weight: bold;">DATE: ${new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Recipient / Requester:</span>
              <span class="meta-val">${batch.requester?.full_name || 'N/A'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Department / Domain:</span>
              <span class="meta-val">${batch.department || batch.requester?.department || 'N/A'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Delivery Destination:</span>
              <span class="meta-val">${batch.location}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Priority / Urgency:</span>
              <span class="meta-val">${batch.urgency || 'Normal'}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                <th>Material Description</th>
                <th style="width: 90px; text-align: center;">Dispatched Qty</th>
                <th style="width: 100px; text-align: center;">Verification</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="font-size: 10px; color: #64748b; font-weight: 600; line-height: 1.5;">
            * Security Note: This document authorizes the transport of the above-listed institutional items across internal and external campus gates.
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-line"></div>
              <span class="sig-label">Authorized Signatory</span>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <span class="sig-label">Receiver's Signature</span>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <span class="sig-label">Security Gate Check</span>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
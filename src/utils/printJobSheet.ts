// src/utils/printJobSheet.ts

export interface JobSheetTechnician {
  id?: string;
  full_name?: string;
  trade?: string;
  phone_number?: string;
}

export interface JobSheetComplaint {
  id?: string;
  complaint_id?: string;
  priority?: string;
  venue?: string;
  zone?: string;
  floor?: string;
  description?: string;
}

export const generateJobSheet = (
  technician: JobSheetTechnician | null | undefined,
  complaints: JobSheetComplaint[]
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const rows = complaints.map((c: JobSheetComplaint, i: number) => `
    <tr>
      <td style="padding: 12px; border: 1px solid #cbd5e1; text-align: center;">${i + 1}</td>
      <td style="padding: 12px; border: 1px solid #cbd5e1;">
        <strong style="color: #8B181B;">${c.complaint_id}</strong><br/>
        <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">${c.priority}</span>
      </td>
      <td style="padding: 12px; border: 1px solid #cbd5e1;">
        <strong>${c.venue}</strong><br/>
        <span style="font-size: 10px; color: #64748b;">${c.zone} ${c.floor && c.floor !== 'N/A' ? `(${c.floor})` : ''}</span>
      </td>
      <td style="padding: 12px; border: 1px solid #cbd5e1;">${c.description}</td>
      <td style="padding: 12px; border: 1px solid #cbd5e1;"></td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Job Sheet - ${technician?.full_name}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #0f172a; margin: 0; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #8B181B; }
          .title { font-size: 24px; font-weight: 900; color: #8B181B; text-transform: uppercase; margin: 0; letter-spacing: 1px; }
          .subtitle { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-top: 5px; }
          .tech-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #f1f5f9; text-align: left; padding: 12px; border: 1px solid #cbd5e1; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: #475569; }
          @media print {
            body { padding: 0; }
            .tech-info { border: 1px solid #cbd5e1; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">Maintenance Job Sheet</h1>
          <div class="subtitle">Al Jamea tus Saifiyah, Siddhpur • Siyanat Operations</div>
        </div>
        
        <div class="tech-info">
          <div>
            <strong>Tradesman:</strong> ${technician?.full_name} <br/>
            <strong>Trade/Category:</strong> ${technician?.trade || 'General Maintenance'}
          </div>
          <div style="text-align: right;">
            <strong>Date Issued:</strong> ${dateStr} <br/>
            <strong>Total Tasks:</strong> ${complaints.length}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th width="5%" style="text-align: center;">#</th>
              <th width="15%">Ticket ID</th>
              <th width="20%">Location</th>
              <th width="40%">Issue Description</th>
              <th width="20%">Tech Sign / Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
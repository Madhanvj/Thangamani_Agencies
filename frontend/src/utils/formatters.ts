export function formatCurrency(amount: number | string | undefined | null): string {
  if (amount === undefined || amount === null || amount === '') return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export function formatDateOnly(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10;
}

export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return true; // Optional field
  // Standard 15-digit GSTIN format in India
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.trim().toUpperCase());
}

/**
 * Builds the WhatsApp caption text for an invoice.
 */
function buildWhatsAppMessage(params: {
  customerName: string;
  invoiceNumber: string;
  grandTotal: number | string;
  balanceDue: number | string;
  companyName?: string;
}): string {
  const { customerName, invoiceNumber, grandTotal, balanceDue, companyName } = params;
  const shop  = companyName || 'Thangamani Agencies';
  const total = typeof grandTotal === 'string' ? parseFloat(grandTotal) : grandTotal;
  const due   = typeof balanceDue === 'string' ? parseFloat(balanceDue) : balanceDue;
  const fmt   = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);

  return [
    `🧾 *Invoice from ${shop}*`,
    ``,
    `Dear *${customerName}*,`,
    ``,
    `Please find your invoice attached:`,
    `📄 Invoice No : *${invoiceNumber}*`,
    `💰 Grand Total : *${fmt(total)}*`,
    due > 0 ? `🔴 Balance Due  : *${fmt(due)}*` : `✅ Payment Status : *FULLY PAID*`,
    ``,
    `Thank you for your purchase! 🙏`,
    `– ${shop}`,
  ].join('\n');
}

/**
 * Shares the invoice PDF via WhatsApp.
 *
 * Strategy:
 *  1. On mobile (Android/iOS) → fetches the PDF, uses the Web Share API
 *     to open the native share sheet so the user can pick WhatsApp directly.
 *  2. On desktop → downloads the PDF and opens WhatsApp Web with the
 *     caption pre-filled, so the user can manually attach the downloaded file.
 *
 * No API key or paid service needed.
 */
export async function sendWhatsAppInvoice(params: {
  invoiceId: number;
  invoiceNumber: string;
  phone: string;
  customerName: string;
  grandTotal: number | string;
  balanceDue: number | string;
  companyName?: string;
  /** Pass the apiClient get function to fetch the PDF blob */
  fetchPdfBlob: (invoiceId: number) => Promise<Blob>;
}): Promise<void> {
  const { invoiceId, invoiceNumber, phone, customerName, grandTotal, balanceDue, companyName, fetchPdfBlob } = params;

  const message = buildWhatsAppMessage({ customerName, invoiceNumber, grandTotal, balanceDue, companyName });
  const fileName = `Invoice_${invoiceNumber}.pdf`;

  // ── Mobile path: Web Share API with file attachment ──────────────────────
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  if (canShareFiles) {
    try {
      const blob = await fetchPdfBlob(invoiceId);
      const file = new File([blob], fileName, { type: 'application/pdf' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Invoice ${invoiceNumber}`,
          text: message,
        });
        return; // Done — user picked WhatsApp from share sheet
      }
    } catch (err: any) {
      // User cancelled or share failed — fall through to desktop path
      if (err?.name === 'AbortError') return;
      console.warn('Web Share API failed, falling back to desktop path', err);
    }
  }

  // ── Desktop path: download PDF + open WhatsApp Web with caption ──────────
  try {
    const blob = await fetchPdfBlob(invoiceId);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    console.warn('PDF download failed');
  }

  // Open WhatsApp Web with pre-filled caption after a short delay
  // so the PDF download starts first
  const digits  = phone.replace(/\D/g, '');
  const waPhone = digits.length === 10 ? `91${digits}` : digits;
  setTimeout(() => {
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`, '_blank');
  }, 800);
}

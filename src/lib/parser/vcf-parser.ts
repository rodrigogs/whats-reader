/**
 * VCF (vCard) Parser for WhatsApp contact cards
 *
 * Extracts contact information from .vcf files included in WhatsApp exports
 * These files contain name and phone number for contacts shared in chat
 */

export interface ContactInfo {
  name: string;
  phoneNumber: string | null;
  whatsappId: string | null; // The waid from WhatsApp
}

/**
 * Parse a single vCard file content
 * 
 * Example VCF content:
 * BEGIN:VCARD
 * VERSION:3.0
 * N:Fontoura;Claudio;;;
 * FN:Claudio Fontoura
 * item1.TEL;waid=555191786084:+55 51 9178-6084
 * item1.X-ABLabel:Celular
 * END:VCARD
 */
export function parseVcf(content: string): ContactInfo | null {
  const lines = content.split(/\r?\n/);
  
  let name: string | null = null;
  let phoneNumber: string | null = null;
  let whatsappId: string | null = null;

  for (const line of lines) {
    // Extract formatted name (FN)
    if (line.startsWith('FN:')) {
      name = line.substring(3).trim();
    }
    
    // Extract phone number and WhatsApp ID
    // Format: item1.TEL;waid=555192049865:+55 51 9204-9865
    // Or: TEL;TYPE=CELL:+55 51 9204-9865
    if (line.includes('TEL')) {
      // Try to extract waid (WhatsApp ID)
      const waidMatch = line.match(/waid=(\d+)/);
      if (waidMatch) {
        whatsappId = waidMatch[1];
      }
      
      // Extract phone number (after the last colon)
      const colonIndex = line.lastIndexOf(':');
      if (colonIndex !== -1) {
        phoneNumber = line.substring(colonIndex + 1).trim();
      }
    }
  }

  if (!name) {
    return null;
  }

  return {
    name,
    phoneNumber,
    whatsappId,
  };
}

/**
 * Format a phone number for display
 * Keeps the original formatting if it looks good, otherwise tries to clean it up
 */
export function formatPhoneNumber(phone: string): string {
  // Already well-formatted (has spaces or dashes)
  if (phone.includes(' ') || phone.includes('-')) {
    return phone;
  }
  
  // Try to format Brazilian numbers (+55...)
  if (phone.startsWith('+55') && phone.length >= 13) {
    const digits = phone.replace(/\D/g, '');
    // Format: +55 XX XXXXX-XXXX
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    // Format: +55 XX XXXX-XXXX (older format)
    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
  }
  
  // Return as-is if we can't format it
  return phone;
}

/**
 * Check if a string looks like a phone number
 */
export function isPhoneNumber(str: string): boolean {
  // Remove common separators and check if mostly digits
  const cleaned = str.replace(/[\s\-\+\(\)]/g, '');
  // Should be at least 8 digits and mostly numeric
  return cleaned.length >= 8 && /^\d+$/.test(cleaned);
}

/**
 * Extract phone number from WhatsApp ID format
 * WhatsApp IDs are usually just the phone number without formatting
 */
export function phoneFromWhatsAppId(waid: string): string {
  // Add + prefix if it's a raw number
  if (/^\d+$/.test(waid)) {
    return `+${waid}`;
  }
  return waid;
}

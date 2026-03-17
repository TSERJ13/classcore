/** Generate a random 6-character alphanumeric student code (e.g. "ID4A3B") */
export function generateStudentCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ID';
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

/**
 * Generate a QR code as a Data URL (PNG) for a given string.
 * Returns the data URL string or empty string on error.
 */
export async function generateQRDataUrl(data: string): Promise<string> {
    try {
        const QRCode = await import('qrcode');
        return await QRCode.toDataURL(data, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#00000000' },
            errorCorrectionLevel: 'M',
        });
    } catch (err) {
        console.error('QR Generation Error:', err);
        return '';
    }
}

/**
 * Image Utilities for ClassCore
 * Handles validation and compression of profile photos and logos.
 */

export const MAX_UPLOAD_SIZE = 2 * 1024 * 1024; // 2MB
export const TARGET_SIZE_KB = 80;
export const MAX_DIMENSION = 1024;

/**
 * Checks if a file is within the maximum allowed size.
 */
export function validateImageSize(file: File): boolean {
    return file.size <= MAX_UPLOAD_SIZE;
}

/**
 * Processes an image file:
 * 1. Resizes to a maximum dimension of 1024px.
 * 2. Compresses to JPEG with quality adjusted to target ~80KB.
 * 3. Returns a Base64 Data URL.
 */
export async function processProfileImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // 1. Resize if necessary
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    if (width > height) {
                        height = Math.round((height * MAX_DIMENSION) / width);
                        width = MAX_DIMENSION;
                    } else {
                        width = Math.round((width * MAX_DIMENSION) / height);
                        height = MAX_DIMENSION;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Fill white background (useful for transparent PNGs converted to JPEG)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                // 2. Initial Compression
                let quality = 0.7;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                
                // 3. Fine-tuning to get closer to 80KB if needed
                // (Optional but good for compliance with "around 80KB")
                const approximateSizeKB = (dataUrl.length * (3 / 4)) / 1024;
                
                if (approximateSizeKB > 100) {
                    quality = 0.5;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                } else if (approximateSizeKB < 40) {
                    quality = 0.9;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error('Failed to load image'));
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

import { LOGO_BASE64, LOGO14_BASE64 } from './logoBase64';

export const loadLogoBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('fetch failed');
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error fetching logo, using fallback base64:', error);
    if (url.includes('login')) {
      return LOGO14_BASE64;
    }
    return LOGO_BASE64;
  }
};

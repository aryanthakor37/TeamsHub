// Real-time Translation Utility for Teams Messages
export async function translateTeamsMessage(text, targetLang = 'gu') {
  if (!text) return text;
  const clean = text.replace(/<[^>]*>/g, '').trim();
  if (!clean) return text;

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|${targetLang}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Translation service unavailable');
    const data = await response.json();
    if (data?.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
    return clean;
  } catch (err) {
    console.warn('Live translation error:', err);
    return clean;
  }
}

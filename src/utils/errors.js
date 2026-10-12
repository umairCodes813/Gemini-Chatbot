// Turns provider errors into short, safe messages for the browser.
export function toClientError(err) {
  if (!err?.status) {
    return { code: 502, message: "Cannot reach the AI service. Check your internet connection and try again." };
  }
  switch (err.status) {
    case 400:
      return { code: 400, message: "The AI service rejected the request. Try a shorter or simpler message." };
    case 401:
      return { code: 401, message: "The API key is invalid. Check your .env file." };
    case 403:
      return { code: 502, message: "Access was denied by the AI service. Check your API key and model access." };
    case 404:
      return { code: 502, message: "Model not found. Check MODEL in .env against the available Gemini models." };
    case 413:
      return { code: 413, message: "This conversation is too long for the current limit. Please start a new chat." };
    case 429:
      return { code: 429, message: "The free usage limit was reached. Please wait a minute and try again." };
    case 503:
      return { code: 503, message: "The AI service is busy right now. Please try again in a moment." };
    default:
      return { code: 500, message: "Something went wrong. Please try again." };
  }
}

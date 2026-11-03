// 04, "Privacy and permission boundaries": mask any card-number pattern to the last 4 digits
// before display or logging. The prompt also asks the model not to return card numbers;
// this runs on its output anyway.

// 12 to 19 digits, optionally grouped by spaces or dashes (all common card lengths).
const CARD_NUMBER = /\b\d(?:[ -]?\d){11,18}\b/g;

export function maskCardNumbers(text: string): string {
  return text.replace(CARD_NUMBER, (match) => {
    const digits = match.replace(/\D/g, "");
    return `•••• ${digits.slice(-4)}`;
  });
}

// Add this helper function at the top of the file after imports
function cleanTelexMessage(message: string): string {
  return message
    .replace(/<\/?[^>]+(>|$)/g, "") // Remove HTML tags
    .trim(); // Remove leading/trailing whitespace
}

export const HelperService = {
  cleanTelexMessage,
};

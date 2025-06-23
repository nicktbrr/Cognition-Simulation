// URL parser for the application.
// It is used to check if a string is a valid URL.
// It is used in the application to check if a string is a valid URL.
// It is used in the application to check if a string is a valid URL.

// Function to check if a string is a valid URL.
export function isValidURL(text: string) {
  const urlPattern =
    /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
  return urlPattern.test(text);
}

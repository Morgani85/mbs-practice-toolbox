const hostname = typeof window !== "undefined" ? window.location.hostname : "";

export const IS_MARKETING_DOMAIN = hostname === "www.practicetoolbox.co.uk";

// When on the www marketing domain, links to the app need the full absolute URL.
// When running locally or on app.practicetoolbox.co.uk, use relative paths.
export const APP_ORIGIN =
  hostname === "www.practicetoolbox.co.uk"
    ? "https://app.practicetoolbox.co.uk"
    : "";

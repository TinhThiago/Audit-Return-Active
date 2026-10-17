export function authSettings(
  origin = window.location.origin,
  base = import.meta.env.BASE_URL,
) {
  // configure-pages base_path may omit the trailing slash. Resolve a file
  // against a directory URL instead of concatenating the path.
  const directory = new URL(base.endsWith("/") ? base : `${base}/`, origin);
  return {
    tenantId:
      import.meta.env.VITE_MICROSOFT_TENANT_ID ||
      "6ab8e229-ae5c-482e-b463-5b926f94e34c",
    clientId:
      import.meta.env.VITE_MICROSOFT_CLIENT_ID ||
      "7c279345-da37-45cc-ab63-70dba694349e",
    redirectUri: new URL("auth-callback.html", directory).href,
  };
}

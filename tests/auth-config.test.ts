import { expect, it } from "vitest";
import { authSettings } from "../src/browser/auth-config";
it.each(["/Audit-Return-Active", "/Audit-Return-Active/"])(
  "resolves project callback when Pages base path is %s",
  (base) => {
    expect(authSettings("https://tinhthiago.github.io", base).redirectUri).toBe(
      "https://tinhthiago.github.io/Audit-Return-Active/auth-callback.html",
    );
  },
);
it.each(["", "/", "./"])(
  "resolves root/custom-domain callback when base is %s",
  (base) => {
    expect(authSettings("https://audit.example.com", base).redirectUri).toBe(
      "https://audit.example.com/auth-callback.html",
    );
  },
);

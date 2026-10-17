import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/tokens.css";
const root = createRoot(document.getElementById("root")!);
void (
  import.meta.env.VITE_RUNTIME_MODE === "browser"
    ? import("./browser/BrowserRoot").then((m) => m.BrowserRoot)
    : import("./app/PowerAppsRoot").then((m) => m.PowerAppsRoot)
)
  .then((Root) =>
    root.render(
      <StrictMode>
        <Root />
      </StrictMode>,
    ),
  )
  .catch(() => {
    root.render(
      <p role="alert">Không tải được ứng dụng. Làm mới trang để thử lại.</p>,
    );
  });

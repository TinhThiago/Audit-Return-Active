import { App } from "./App";
import { ServicesProvider } from "./providers";
import { PowerAppsTransport } from "../data/powerAppsTransport";
const transport = new PowerAppsTransport();
export function PowerAppsRoot() {
  return (
    <ServicesProvider transport={transport}>
      <App />
    </ServicesProvider>
  );
}

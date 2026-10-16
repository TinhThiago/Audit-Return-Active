import { createContext, useContext, useMemo, type ReactNode } from "react";
import { PowerAppsTransport } from "../data/powerAppsTransport";
import { MetadataService } from "../data/metadataService";
import { AuditService } from "../data/auditService";
import { RecordService } from "../data/recordService";
const Context = createContext<{
  metadata: MetadataService;
  audit: AuditService;
  records: RecordService;
} | null>(null);
export function ServicesProvider({ children }: { children: ReactNode }) {
  const services = useMemo(() => {
    const transport = new PowerAppsTransport();
    return {
      metadata: new MetadataService(transport),
      audit: new AuditService(transport),
      records: new RecordService(transport),
    };
  }, []);
  return <Context.Provider value={services}>{children}</Context.Provider>;
}
export function useServices() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing services provider");
  return value;
}

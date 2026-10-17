import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DataverseTransport } from "../data/transport";
import { MetadataService } from "../data/metadataService";
import { AuditService } from "../data/auditService";
import { RecordService } from "../data/recordService";
const Context = createContext<{
  metadata: MetadataService;
  audit: AuditService;
  records: RecordService;
} | null>(null);
export function ServicesProvider({
  children,
  transport,
}: {
  children: ReactNode;
  transport: DataverseTransport;
}) {
  const services = useMemo(() => {
    return {
      metadata: new MetadataService(transport),
      audit: new AuditService(transport),
      records: new RecordService(transport),
    };
  }, [transport]);
  return <Context.Provider value={services}>{children}</Context.Provider>;
}
export function useServices() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing services provider");
  return value;
}

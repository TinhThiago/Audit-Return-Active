export type JsonRow = Record<string, unknown>;
export interface StateOption {
  value: number;
  label: string;
  defaultStatus?: number;
  invariantName?: string;
}
export interface StatusOption {
  value: number;
  label: string;
  state: number;
}
export interface TableMetadata {
  logicalName: string;
  entitySetName: string;
  primaryIdAttribute: string;
  primaryNameAttribute?: string;
  displayName: string;
  auditEnabled: boolean;
  objectTypeCode?: number;
  isCustomEntity?: boolean;
  isActivity?: boolean;
  states: StateOption[];
  statuses: StatusOption[];
  fields: Record<string, string>;
}
export interface ODataPage<T> {
  value: T[];
  "@odata.nextLink"?: string;
}
export interface AuditEvent {
  id: string;
  recordId: string;
  at: string;
  user: string;
  operation: number;
  action: string;
}
export interface AuditFilter {
  table: TableMetadata;
  mode: "createUpdate" | "delete";
  recordId?: string;
  from?: string;
  to?: string;
}
export interface AuditPage {
  events: AuditEvent[];
  continuation?: string;
}
export interface AuditValue {
  available: boolean;
  value: unknown;
  formatted?: string;
}
export interface AuditChange {
  field: string;
  label: string;
  old: AuditValue;
  new: AuditValue;
}
export interface RecordSnapshot {
  id: string;
  name: string;
  state: number;
  status: number;
  stateLabel: string;
  statusLabel: string;
  etag?: string;
  table: string;
}
export type ActivationResult =
  | { kind: "verifiedActive" | "alreadyActive"; record: RecordSnapshot }
  | { kind: "verificationPending"; message: string };

import { ScopedTransport, type HttpRequest } from "./requestTransport";
export { safePath } from "./requestTransport";
type ConnectorResult = { success: boolean; data: unknown; error?: unknown };
async function invoke(request: HttpRequest): Promise<ConnectorResult> {
  const [{ getClient }, { dataSourcesInfo }] = await Promise.all([
    import("@microsoft/power-apps/data"),
    import("../../.power/schemas/appschemas/dataSourcesInfo"),
  ]);
  return getClient(dataSourcesInfo).executeAsync<
    { request: HttpRequest },
    unknown
  >({
    connectorOperation: {
      tableName: "webcontents",
      operationName: "InvokeHttp",
      parameters: { request },
    },
  });
}

export class PowerAppsTransport extends ScopedTransport {
  constructor(call = invoke) {
    super(call);
  }
}

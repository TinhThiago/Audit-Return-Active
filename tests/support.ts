import type {
  DataverseRequest,
  DataverseTransport,
} from "../src/data/transport";
export class FakeTransport implements DataverseTransport {
  requests: DataverseRequest[] = [];
  constructor(
    private respond: (r: DataverseRequest) => unknown | Promise<unknown>,
  ) {}
  async request<T>(r: DataverseRequest): Promise<T> {
    this.requests.push(r);
    return (await this.respond(r)) as T;
  }
}

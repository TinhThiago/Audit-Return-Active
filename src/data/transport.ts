export interface DataverseRequest {
  method: "GET" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
  signal?: AbortSignal;
  etag?: string;
}
export interface DataverseTransport {
  request<T>(request: DataverseRequest): Promise<T>;
}
export class DataverseError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "DataverseError";
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof DataverseError) {
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Mở lại app và đăng nhập để tiếp tục.";
    if (error.status === 403)
      return "Bạn chưa có quyền đọc audit, cập nhật hoặc xóa bản ghi này. Liên hệ quản trị môi trường.";
    if (error.status === 404)
      return "Không tìm thấy bản ghi hoặc dữ liệu audit đã được xóa khỏi hệ thống.";
    if (error.status === 412)
      return "Bản ghi đã thay đổi. Tải lại trước khi cập nhật hoặc xóa.";
    if (error.status === 429)
      return "Dataverse đang giới hạn số request. Vui lòng thử lại sau.";
  }
  return error instanceof Error
    ? error.message
    : "Không thể kết nối Dataverse. Vui lòng thử lại.";
}

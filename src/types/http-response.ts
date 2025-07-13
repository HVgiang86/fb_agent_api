export interface BaseResponse<T = any> {
  statusCode: number;
  message: string;
  data?: T;
}

export class HttpResponse {
  static success<T = any>(
    data?: T,
    message = 'Thành công',
    statusCode = 200,
  ): BaseResponse<T> {
    const response: BaseResponse<T> = {
      statusCode,
      message,
    };

    if (data !== undefined) {
      response.data = data;
    }

    return response;
  }

  static error(message: string, statusCode = 400): BaseResponse {
    return {
      statusCode,
      message,
    };
  }

  static created<T = any>(
    data?: T,
    message = 'Tạo thành công',
  ): BaseResponse<T> {
    return this.success(data, message, 201);
  }

  static badRequest(message = 'Yêu cầu không hợp lệ'): BaseResponse {
    return this.error(message, 400);
  }

  static unauthorized(message = 'Không có quyền truy cập'): BaseResponse {
    return this.error(message, 401);
  }

  static forbidden(message = 'Không có quyền thực hiện'): BaseResponse {
    return this.error(message, 403);
  }

  static notFound(message = 'Không tìm thấy'): BaseResponse {
    return this.error(message, 404);
  }

  static conflict(message = 'Xung đột dữ liệu'): BaseResponse {
    return this.error(message, 409);
  }

  static internalServerError(message = 'Lỗi hệ thống'): BaseResponse {
    return this.error(message, 500);
  }
}

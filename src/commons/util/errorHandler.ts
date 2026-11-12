import { HttpException } from '@nestjs/common';

export const handleServiceMethodError = (
  error: any,
  message: string = 'An Error occurred',
): any => {
  if (error instanceof HttpException) {
    throw error;
  }
  console.error(message, ": ", error)

  throw new HttpException({ message, success: false }, 500);
};

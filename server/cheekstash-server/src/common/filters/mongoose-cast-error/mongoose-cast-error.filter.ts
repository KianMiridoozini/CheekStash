import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { Error as MongooseError } from 'mongoose'; // <-- Correct Import

@Catch(MongooseError.CastError) // <-- Catch specific error
export class MongooseCastErrorFilter implements ExceptionFilter {
  catch(exception: MongooseError.CastError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Log the exception during test to be sure it's the right type
    // console.error('MongooseCastErrorFilter caught:', exception);

    const message = `Invalid value provided for field ${exception.path}`; // Mongoose provides the path (_id in this case)

    response
      .status(HttpStatus.BAD_REQUEST)
      .json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: message,
        error: 'Bad Request'
      });
  }
}
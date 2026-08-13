import express from 'express';
import { ObjectSchema } from 'joi';
import { ValidationError } from '../utils/errors';

export function validate(schema: ObjectSchema) {
  return (req: express.Request, _res: express.Response, next: express.NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      throw new ValidationError(message);
    }

    req.body = value;
    next();
  };
}

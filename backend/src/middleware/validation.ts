import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorMessages
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        error: 'Invalid request data'
      });
    }
  };
};

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorMessages
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        error: 'Invalid request data'
      });
    }
  };
};

export const validateParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorMessages
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        error: 'Invalid request parameters'
      });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errorMessages
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters'
      });
    }
  };
};

export default { validate, validateBody, validateParams, validateQuery };

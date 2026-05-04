import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export interface AuthedRequest extends Request {
  clerkId: string;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).clerkId = auth.userId;
  next();
}

import { z } from "zod/v4";

export const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number().int(),
  contentType: z.string(),
});

export const RequestUploadUrlResponseMetadata = z.object({
  name: z.string(),
  size: z.number().int(),
  contentType: z.string(),
});

export const RequestUploadUrlResponse = z.object({
  uploadURL: z.string(),
  objectPath: z.string(),
  metadata: RequestUploadUrlResponseMetadata,
});

export type RequestUploadUrlBodyType = z.infer<typeof RequestUploadUrlBody>;
export type RequestUploadUrlResponseType = z.infer<typeof RequestUploadUrlResponse>;

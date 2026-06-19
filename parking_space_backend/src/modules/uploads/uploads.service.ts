/**
 * Uploads service — compress/store an uploaded file and return its public URL.
 */
import { BadRequest } from '../../lib/http.js';
import { storeImageBuffer, storeDocumentBuffer } from '../../lib/images.js';

export const storeImage = async (file?: Express.Multer.File) => {
  if (!file) throw BadRequest('No file uploaded');
  return storeImageBuffer(file.buffer);
};

export const storeDocument = async (file?: Express.Multer.File) => {
  if (!file) throw BadRequest('No file uploaded');
  return storeDocumentBuffer(file.buffer, file.mimetype);
};

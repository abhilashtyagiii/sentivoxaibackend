import multer from "multer";
import path from "path";
import fs from "fs";

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter for audio files only
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav'];
  const allowedExts = ['.mp3', '.wav', '.m4a'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files (MP3, WAV, M4A) are allowed'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

export function validateAudioFile(file: Express.Multer.File): boolean {
  const allowedExts = ['.mp3', '.wav', '.m4a'];
  const ext = path.extname(file.originalname).toLowerCase();
  return allowedExts.includes(ext) && file.size <= 100 * 1024 * 1024;
}

const resumeFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const allowedExts = ['.pdf', '.doc', '.docx'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and Word documents (.pdf, .doc, .docx) are allowed'), false);
  }
};

export const resumeUpload = multer({
  storage,
  fileFilter: resumeFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  }
});

export function validateResumeFile(file: Express.Multer.File): boolean {
  const allowedExts = ['.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  return allowedExts.includes(ext) && file.size <= 10 * 1024 * 1024;
}

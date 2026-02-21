const { S3Client } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined, // Use IAM role if credentials not provided
});

const BUCKET_NAME = process.env.S3_DRIVER_DOCS_BUCKET || 'tbidder-driver-docs';

module.exports = { s3Client, BUCKET_NAME };

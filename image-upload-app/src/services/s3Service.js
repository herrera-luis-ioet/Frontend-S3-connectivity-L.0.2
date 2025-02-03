import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// PUBLIC_INTERFACE
/**
 * S3 service for handling image uploads and retrievals
 */
class S3Service {
  constructor() {
    this.validateCredentials();
    this.s3Client = new S3Client({
      region: process.env.REACT_APP_AWS_REGION,
      credentials: {
        accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = process.env.REACT_APP_S3_BUCKET_NAME;
  }

  /**
   * Validates that all required AWS credentials are present
   * @throws {Error} If any required credentials are missing
   */
  validateCredentials() {
    const requiredEnvVars = {
      'REACT_APP_AWS_REGION': process.env.REACT_APP_AWS_REGION,
      'REACT_APP_AWS_ACCESS_KEY_ID': process.env.REACT_APP_AWS_ACCESS_KEY_ID,
      'REACT_APP_AWS_SECRET_ACCESS_KEY': process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
      'REACT_APP_S3_BUCKET_NAME': process.env.REACT_APP_S3_BUCKET_NAME
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      throw new Error(`Missing required AWS credentials: ${missingVars.join(', ')}. Please check your .env file.`);
    }
  }

  /**
   * Upload an image to S3
   * @param {File} file - The file to upload
   * @param {string} fileName - The name to use for the file in S3
   * @returns {Promise<string>} - The URL of the uploaded file
   * @throws {Error} - If upload fails
   */
  async uploadImage(file, fileName) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file,
        ContentType: file.type,
      });

      await this.s3Client.send(command);
      return `https://${this.bucketName}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(error.message || 'Failed to upload image');
    }
  }

  /**
   * Retrieve an image from S3
   * @param {string} fileName - The name of the file to retrieve
   * @returns {Promise<Blob>} - The file data
   * @throws {Error} - If retrieval fails
   */
  async getImage(fileName) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      const response = await this.s3Client.send(command);
      const arrayBuffer = await response.Body.transformToByteArray();
      return new Blob([arrayBuffer], { type: response.ContentType });
    } catch (error) {
      console.error('Error retrieving file:', error);
      throw new Error(error.message || 'Failed to retrieve image');
    }
  }
}

const s3Service = new S3Service();
export default s3Service;

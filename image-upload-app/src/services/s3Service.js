import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import ENV_CONFIG, { getEnvVar } from '../config/environment';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_CACHE_SIZE = 100; // Maximum number of items in cache

/**
 * Validates S3 bucket name according to AWS naming rules
 * @param {string} bucketName - The bucket name to validate
 * @throws {Error} If bucket name is invalid
 */
const validateBucketName = (bucketName) => {
  if (!bucketName) {
    throw new Error('Bucket name cannot be empty');
  }

  if (bucketName.length < 3 || bucketName.length > 63) {
    throw new Error('Bucket name must be between 3 and 63 characters long');
  }

  // AWS S3 bucket naming rules
  const validBucketNameRegex = /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
  if (!validBucketNameRegex.test(bucketName)) {
    throw new Error(
      'Invalid bucket name format. Bucket names must:\n' +
      '- Contain only lowercase letters, numbers, dots (.), and hyphens (-)\n' +
      '- Begin and end with a letter or number\n' +
      '- Not contain consecutive periods\n' +
      '- Not be formatted as an IP address'
    );
  }

  if (bucketName.includes('..')) {
    throw new Error('Bucket name cannot contain consecutive periods');
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(bucketName)) {
    throw new Error('Bucket name cannot be formatted as an IP address');
  }
};

/**
 * Validates environment variables and bucket name
 * @throws {Error} If any required environment variables are missing or invalid
 */
const validateEnvironmentVars = () => {
  const bucketName = getEnvVar('bucketName', ENV_CONFIG.aws.bucketName);
  validateBucketName(bucketName);
  
  // Validate other required variables
  getEnvVar('region', ENV_CONFIG.aws.region);
  getEnvVar('accessKeyId', ENV_CONFIG.aws.accessKeyId);
  getEnvVar('secretAccessKey', ENV_CONFIG.aws.secretAccessKey);
};

// PUBLIC_INTERFACE
/**
 * S3 service for handling image uploads and retrievals
 */
class S3Service {
  constructor() {
    this.validateCredentials();
    this.s3Client = new S3Client({
      region: getEnvVar('region', ENV_CONFIG.aws.region),
      credentials: {
        accessKeyId: getEnvVar('accessKeyId', ENV_CONFIG.aws.accessKeyId),
        secretAccessKey: getEnvVar('secretAccessKey', ENV_CONFIG.aws.secretAccessKey),
      },
    });
    this.bucketName = getEnvVar('bucketName', ENV_CONFIG.aws.bucketName);
    this.imageCache = new Map();
    this.cacheQueue = []; // For implementing LRU cache eviction
  }

  /**
   * Validates that all required AWS credentials are present
   * @throws {Error} If any required credentials are missing
   */
  validateCredentials() {
    validateEnvironmentVars();
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
      // Convert File object to ArrayBuffer for reliable upload
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: uint8Array,
        ContentType: file.type,
      });

      await this.s3Client.send(command);
      return `https://${this.bucketName}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`Error: Failed to upload image - ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Retrieve an image from S3
   * @param {string} fileName - The name of the file to retrieve
   * @returns {Promise<Blob>} - The file data
   * @throws {Error} - If retrieval fails
   */
  /**
   * Get an image from cache or S3
   * @param {string} fileName - The name of the file to retrieve
   * @returns {Promise<Blob>} - The file data
   * @throws {Error} - If retrieval fails
   */
  async getImage(fileName) {
    try {
      // Check cache first
      const cachedImage = this.getCachedImage(fileName);
      if (cachedImage) {
        return cachedImage;
      }

      // If not in cache, fetch from S3
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });

      const response = await this.s3Client.send(command);
      const arrayBuffer = await response.Body.transformToByteArray();
      const blob = new Blob([arrayBuffer], { type: response.ContentType });
      
      // Cache the fetched image
      this.cacheImage(fileName, blob);
      
      return blob;
    } catch (error) {
      console.error('Error retrieving file:', error);
      throw new Error(`Error: Failed to retrieve image - ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get an image from the cache if it exists and is not expired
   * @private
   * @param {string} fileName - The name of the file to retrieve from cache
   * @returns {Blob|null} - The cached image or null if not found/expired
   */
  getCachedImage(fileName) {
    try {
      const cacheEntry = this.imageCache.get(fileName);
      if (!cacheEntry) {
        return null;
      }

      const { blob, timestamp } = cacheEntry;
      const now = Date.now();

      // Check if cache entry has expired
      if (now - timestamp > CACHE_TTL) {
        this.imageCache.delete(fileName);
        this.cacheQueue = this.cacheQueue.filter(key => key !== fileName);
        return null;
      }

      // Move the accessed item to the end of the queue (most recently used)
      this.cacheQueue = this.cacheQueue.filter(key => key !== fileName);
      this.cacheQueue.push(fileName);

      return blob;
    } catch (error) {
      console.warn('Cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Cache an image with timestamp
   * @private
   * @param {string} fileName - The name of the file to cache
   * @param {Blob} blob - The image data to cache
   */
  cacheImage(fileName, blob) {
    try {
      // Implement cache eviction if cache is full
      while (this.imageCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = this.cacheQueue.shift();
        if (oldestKey) {
          this.imageCache.delete(oldestKey);
        }
      }

      // Add new entry to cache
      this.imageCache.set(fileName, {
        blob,
        timestamp: Date.now()
      });
      this.cacheQueue.push(fileName);
    } catch (error) {
      console.warn('Cache storage error:', error);
    }
  }

  /**
   * Clear the entire image cache
   * @public
   */
  clearCache() {
    try {
      this.imageCache.clear();
      this.cacheQueue = [];
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw new Error('Failed to clear image cache');
    }
  }
  async listImages() {
    const bucketName = this.bucketName;
    const command = new ListObjectsV2Command({ Bucket: bucketName });
  
    try {
      const { Contents } = await this.s3Client.send(command);
      const imageFiles = Contents?.filter(obj =>
        obj.Key.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      ).map(obj => `https://${bucketName}.s3.amazonaws.com/${obj.Key}`);
  
      return imageFiles
    } catch (err) {
      console.error("Error listing objects:", err);
    }
  
  }
}

const s3Service = new S3Service();
export default s3Service;

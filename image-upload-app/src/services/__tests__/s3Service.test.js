import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import ENV_CONFIG, { getEnvVar } from '../../config/environment';

// Mock AWS SDK, console.error, and environment config
jest.mock('@aws-sdk/client-s3');
jest.mock('../../config/environment');
console.error = jest.fn();

// Import s3Service
import s3Service from '../s3Service';

// Get mock functions from global scope
const { __mockS3Send: mockS3Send, __mockS3Client: mockS3Client } = global;

// Helper function to create mock file
const createMockFile = (content, name, type) => {
  const file = new File([content], name, { type });
  file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
  return file;
};

describe('S3Service', () => {
  const mockEnvValues = {
    region: 'us-east-1',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucketName: 'test-image-upload-bucket'
  };

  // Mock environment configuration
  beforeAll(() => {
    getEnvVar.mockImplementation((key, config) => {
      const envMap = {
        [ENV_CONFIG.aws.region.key]: mockEnvValues.region,
        [ENV_CONFIG.aws.accessKeyId.key]: mockEnvValues.accessKeyId,
        [ENV_CONFIG.aws.secretAccessKey.key]: mockEnvValues.secretAccessKey,
        [ENV_CONFIG.aws.bucketName.key]: mockEnvValues.bucketName
      };
      return envMap[config.key];
    });
  });

  const invalidBucketNames = [
    'Test-Bucket',  // Contains uppercase
    'test_bucket',  // Contains underscore
    'te',          // Too short
    'a'.repeat(64), // Too long
    '.test-bucket', // Starts with period
    'test-bucket.', // Ends with period
    'test..bucket', // Contains consecutive periods
    '192.168.1.1',  // IP address format
    '',             // Empty string
    'test@bucket',  // Invalid character
    'test bucket',  // Contains space
    'test/bucket'   // Contains slash
  ];

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockS3Send.mockReset();
    mockS3Client.mockReset();
    mockS3Client.mockImplementation(() => ({
      send: mockS3Send
    }));
  });

  describe('validateCredentials', () => {
    it('should not throw error when all credentials are present', () => {
      expect(() => s3Service.validateCredentials()).not.toThrow();
    });

    it('should throw error when credentials are missing', () => {
      getEnvVar.mockImplementationOnce(() => {
        throw new Error(`Required environment variable ${ENV_CONFIG.aws.region.key} is not set`);
      });
      expect(() => s3Service.validateCredentials())
        .toThrow(`Required environment variable ${ENV_CONFIG.aws.region.key} is not set`);
    });

    it('should throw error when multiple credentials are missing', () => {
      getEnvVar.mockImplementation((key, config) => {
        if (config.key === ENV_CONFIG.aws.region.key || config.key === ENV_CONFIG.aws.accessKeyId.key) {
          throw new Error(`Required environment variable ${config.key} is not set`);
        }
        return mockEnvValues[key];
      });
      expect(() => s3Service.validateCredentials())
        .toThrow(/Required environment variable.*is not set/);
    });

    it('should throw error for invalid bucket name formats', () => {
      const expectedErrors = {
        'Test-Bucket': 'Invalid bucket name format',
        'test_bucket': 'Invalid bucket name format',
        'te': 'Bucket name must be between 3 and 63 characters long',
        [('a'.repeat(64))]: 'Bucket name must be between 3 and 63 characters long',
        '.test-bucket': 'Invalid bucket name format',
        'test-bucket.': 'Invalid bucket name format',
        'test..bucket': 'Bucket name cannot contain consecutive periods',
        '192.168.1.1': 'Bucket name cannot be formatted as an IP address',
        '': 'Bucket name cannot be empty',
        'test@bucket': 'Invalid bucket name format',
        'test bucket': 'Invalid bucket name format',
        'test/bucket': 'Invalid bucket name format'
      };

      Object.entries(expectedErrors).forEach(([bucketName, errorMessage]) => {
        getEnvVar.mockImplementation((key, config) => {
          if (config.key === ENV_CONFIG.aws.bucketName.key) {
            return bucketName;
          }
          return mockEnvValues[key];
        });
        expect(() => s3Service.validateCredentials()).toThrow(errorMessage);
      });
    });

    it('should accept valid bucket names', () => {
      const validBucketNames = [
        'my-test-bucket',
        'test-123',
        'my.test.bucket',
        'test-bucket-123'
      ];

      validBucketNames.forEach(bucketName => {
        getEnvVar.mockImplementation((key, config) => {
          if (config.key === ENV_CONFIG.aws.bucketName.key) {
            return bucketName;
          }
          return mockEnvValues[key];
        });
        expect(() => s3Service.validateCredentials()).not.toThrow();
      });
    });
  });

  describe('uploadImage', () => {
    const mockFile = createMockFile('test image content', 'test.jpg', 'image/jpeg');
    const mockFileName = 'test-upload.jpg';

    beforeEach(() => {
      // Mock successful upload
      mockS3Send.mockResolvedValue({});
      S3Client.prototype.send = mockS3Send;
    });

    it('should successfully upload a file', async () => {
      const result = await s3Service.uploadImage(mockFile, mockFileName);
      
      // Verify S3 client was called with correct parameters
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: mockEnvValues.bucketName,
        Key: mockFileName,
        Body: expect.any(Buffer),
        ContentType: mockFile.type,
      });
      
      // Verify URL format
      expect(result).toBe(`https://${mockEnvValues.bucketName}.s3.${mockEnvValues.region}.amazonaws.com/${mockFileName}`);
    });

    it('should handle upload errors', async () => {
      const errorMessage = 'Upload failed';
      S3Client.prototype.send.mockRejectedValue(new Error(errorMessage));
      
      await expect(s3Service.uploadImage(mockFile, mockFileName))
        .rejects.toThrow('Error: Failed to upload image - Upload failed');
      expect(console.error).toHaveBeenCalledWith('Error uploading file:', expect.any(Error));
    });

    it('should handle large files', async () => {
      const largeContent = new Array(1024 * 1024).fill('a').join(''); // 1MB content
      const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
      largeFile.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(largeContent.length));
      
      await expect(s3Service.uploadImage(largeFile, 'large.jpg')).resolves.not.toThrow();
    });

    it('should handle different file types', async () => {
      const fileTypes = [
        { content: 'test', name: 'test.png', type: 'image/png' },
        { content: 'test', name: 'test.pdf', type: 'application/pdf' },
        { content: 'test', name: 'test.txt', type: 'text/plain' }
      ];

      for (const fileInfo of fileTypes) {
        const file = new File([fileInfo.content], fileInfo.name, { type: fileInfo.type });
        file.arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
        
        await expect(s3Service.uploadImage(file, fileInfo.name)).resolves.not.toThrow();
        expect(PutObjectCommand).toHaveBeenCalledWith(expect.objectContaining({
          ContentType: fileInfo.type
        }));
      }
    });
  });

  describe('getImage', () => {
    const mockFileName = 'test-image.jpg';
    const mockContentType = 'image/jpeg';
    const mockArrayBuffer = new Uint8Array([1, 2, 3, 4]).buffer;

    beforeEach(() => {
      // Mock successful image retrieval
      mockS3Send.mockResolvedValue({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(new Uint8Array(mockArrayBuffer))
        },
        ContentType: mockContentType
      });
      S3Client.prototype.send = mockS3Send;
    });

    it('should successfully retrieve an image', async () => {
      const result = await s3Service.getImage(mockFileName);
      
      // Verify S3 client was called with correct parameters
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: mockEnvValues.bucketName,
        Key: mockFileName
      });
      
      // Verify returned Blob
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe(mockContentType);
    });

    it('should handle retrieval errors', async () => {
      const errorMessage = 'Retrieval failed';
      S3Client.prototype.send.mockRejectedValue(new Error(errorMessage));
      
      await expect(s3Service.getImage(mockFileName))
        .rejects.toThrow(`Error: Failed to retrieve image - ${errorMessage}`);
      expect(console.error).toHaveBeenCalledWith('Error retrieving file:', expect.any(Error));
    });

    it('should handle missing files', async () => {
      S3Client.prototype.send.mockRejectedValue(new Error('NoSuchKey'));
      
      await expect(s3Service.getImage('non-existent.jpg'))
        .rejects.toThrow();
    });
  });
});

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock environment variables for AWS S3
const mockEnvValues = {
  REACT_APP_AWS_REGION: 'us-east-1',
  REACT_APP_AWS_BUCKET: 'test-image-upload-bucket',
  REACT_APP_AWS_ACCESS_KEY_ID: 'test-key',
  REACT_APP_AWS_SECRET_ACCESS_KEY: 'test-secret',
  NODE_ENV: 'test'
};

// Set environment variables
process.env = {
  ...process.env,
  ...mockEnvValues
};

// Mock environment.js module
jest.mock('./config/environment', () => ({
  __esModule: true,
  default: {
    aws: {
      region: { key: 'REACT_APP_AWS_REGION' },
      bucketName: { key: 'REACT_APP_AWS_BUCKET' },
      accessKeyId: { key: 'REACT_APP_AWS_ACCESS_KEY_ID' },
      secretAccessKey: { key: 'REACT_APP_AWS_SECRET_ACCESS_KEY' }
    }
  },
  getEnvVar: jest.fn((key, config) => process.env[config.key])
}));

// Mock AWS SDK v3
const mockSend = jest.fn();
const mockS3Client = jest.fn(() => ({
  send: mockSend
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client,
  PutObjectCommand: jest.fn((params) => ({
    ...params,
    input: params
  })),
  GetObjectCommand: jest.fn((params) => ({
    ...params,
    input: params
  }))
}));

// Export mock functions for test usage
global.__mockS3Send = mockSend;
global.__mockS3Client = mockS3Client;

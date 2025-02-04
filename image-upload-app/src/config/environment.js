// Environment variable configuration
const ENV_CONFIG = {
  aws: {
    region: {
      key: 'REACT_APP_AWS_REGION',
      default: 'us-east-1',
      required: true,
    },
    accessKeyId: {
      key: 'REACT_APP_AWS_ACCESS_KEY_ID',
      required: true,
    },
    secretAccessKey: {
      key: 'REACT_APP_AWS_SECRET_ACCESS_KEY',
      required: true,
    },
    bucketName: {
      key: 'REACT_APP_S3_BUCKET_NAME',
      required: true,
    },
  },
};

/**
 * Get environment variable value with fallback to default
 * @param {string} key - Environment variable key
 * @param {Object} config - Configuration object for the environment variable
 * @returns {string} Environment variable value
 * @throws {Error} If required variable is missing
 */
export const getEnvVar = (key, config) => {
  const value = process.env[config.key];
  
  if (!value && config.required) {
    throw new Error(`Required environment variable ${config.key} is not set`);
  }
  
  return value || config.default;
};

export default ENV_CONFIG;
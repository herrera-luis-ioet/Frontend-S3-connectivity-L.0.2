#!/bin/bash
cd /home/kavia/workspace/Frontend-S3-connectivity-L.0.2/image-upload-app

# 1.) Run the linter on the files or directories passed as arguments
npx eslint --fix "$@"
ESLINT_EXIT_CODE=$?

# 2.) Test the packaging of the application
npm run build
BUILD_EXIT_CODE=$?

# Exit with error if either command failed
if [ $ESLINT_EXIT_CODE -ne 0 ] || [ $BUILD_EXIT_CODE -ne 0 ]; then
   exit 1
fi
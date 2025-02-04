import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ImageUpload, { ERROR_TYPES } from '../ImageUpload';
import s3Service from '../../../services/s3Service';
import ENV_CONFIG, { getEnvVar } from '../../../config/environment';

// Mock s3Service, environment config, and console.error
jest.mock('../../../services/s3Service');
jest.mock('../../../config/environment');
console.error = jest.fn();

// Mock environment values
const mockEnvValues = {
  region: 'us-east-1',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
  bucketName: 'test-image-upload-bucket'
};

// Setup environment configuration mock
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

// Mock formatErrorMessage function
const formatErrorMessage = (type, fileName) => {
  const messages = {
    [ERROR_TYPES.INVALID_TYPE]: `Invalid file type: "${fileName}" is not an image file`,
    [ERROR_TYPES.SIZE_EXCEEDED]: `File size exceeded: "${fileName}" is too large (max 5MB)`,
    [ERROR_TYPES.NO_VALID_FILES]: 'No valid files: Please provide at least one valid image file'
  };
  return messages[type] || 'An unknown error occurred';
};

// Mock window.matchMedia for responsive design tests
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};

// Mock focus management
const mockFocus = jest.fn();
HTMLElement.prototype.focus = mockFocus;

describe('ImageUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockOnUploadError = jest.fn();
  const defaultProps = {
    onUploadSuccess: mockOnUploadSuccess,
    onUploadError: mockOnUploadError,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upload area with correct text', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    expect(screen.getByText(/drag and drop images here/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to select files/i)).toBeInTheDocument();
    expect(screen.getByText(/supports: jpg, png, gif/i)).toBeInTheDocument();
  });

  it('handles drag enter and leave events', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const uploadArea = screen.getByTestId('upload-area');

    await act(async () => {
      fireEvent.dragEnter(uploadArea);
    });
    expect(screen.getByText(/drop images here/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.dragLeave(uploadArea);
    });
    expect(screen.getByText(/drag and drop images here/i)).toBeInTheDocument();
  });

  it('validates file type correctly using ERROR_TYPES', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    const input = screen.getByLabelText('Choose image files to upload');

    // Test invalid file type
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const expectedErrorMessage = formatErrorMessage(ERROR_TYPES.INVALID_TYPE, 'test.txt');
    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith(expectedErrorMessage);
      expect(screen.getByRole('alert')).toHaveTextContent(expectedErrorMessage);
    });

    // Test valid file type
    s3Service.uploadImage.mockResolvedValueOnce('https://example.com/test.jpg');
    await act(async () => {
      fireEvent.change(input, { target: { files: [imageFile] } });
    });
    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(['https://example.com/test.jpg']);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('validates file size correctly using ERROR_TYPES', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    // Create a file larger than 5MB (5 * 1024 * 1024 bytes)
    const largeContent = new Array(6 * 1024 * 1024).fill('a').join('');
    const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Choose image files to upload');

    await act(async () => {
      fireEvent.change(input, { target: { files: [largeFile] } });
    });

    const expectedErrorMessage = formatErrorMessage(ERROR_TYPES.SIZE_EXCEEDED, 'large.jpg');
    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith(expectedErrorMessage);
      expect(screen.getByRole('alert')).toHaveTextContent(expectedErrorMessage);
    });
  });

  it('handles multiple file upload correctly', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const files = [
      new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
      new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
    ];

    s3Service.uploadImage
      .mockResolvedValueOnce('https://example.com/test1.jpg')
      .mockResolvedValueOnce('https://example.com/test2.jpg');

    const input = screen.getByLabelText('Choose image files to upload');
    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith([
        'https://example.com/test1.jpg',
        'https://example.com/test2.jpg',
      ]);
    });
  });

  it('shows upload progress during file upload', async () => {
    let resolvePromise;
    const uploadPromise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    s3Service.uploadImage.mockImplementation(() => uploadPromise);

    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('Choose image files to upload');

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const progressBar = await screen.findByLabelText('Upload progress');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByText(/uploading your images/i)).toBeInTheDocument();

    await act(async () => {
      resolvePromise('https://example.com/test.jpg');
    });

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(['https://example.com/test.jpg']);
    });
  });

  it('handles upload errors correctly', async () => {
    await act(async () => {
      render(<ImageUpload {...defaultProps} />);
    });

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    s3Service.uploadImage.mockRejectedValueOnce(new Error('Upload failed'));

    const input = screen.getByLabelText('Choose image files to upload');
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(mockOnUploadError).toHaveBeenCalledWith('Error: Failed to upload image - Upload failed');
      expect(console.error).toHaveBeenCalledWith('Error uploading file:', expect.any(Error));
    });
  });

  // Visual feedback and animation tests
  describe('Visual feedback features', () => {
    it('shows hover state styles and animations on upload area', async () => {
      render(<ImageUpload {...defaultProps} />);
      const uploadArea = screen.getByTestId('upload-area');

      // Test hover state
      await act(async () => {
        fireEvent.mouseEnter(uploadArea);
      });

      // Check base styles
      expect(uploadArea).toHaveClass('MuiBox-root');
      expect(uploadArea).toHaveStyle({
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      });

      // Check hover styles
      await waitFor(() => {
        expect(uploadArea).toHaveStyle({
          transform: 'scale(1.01)'
        });
      });

      // Test hover exit
      await act(async () => {
        fireEvent.mouseLeave(uploadArea);
      });

      // Check return to default styles
      await waitFor(() => {
        expect(uploadArea).toHaveStyle({
          transform: 'scale(1)'
        });
      });
    });

    it('shows drag state animations and visual feedback', async () => {
      render(<ImageUpload {...defaultProps} />);
      const uploadArea = screen.getByTestId('upload-area');

      // Test drag enter state
      await act(async () => {
        fireEvent.dragEnter(uploadArea);
      });

      // Check drag enter styles and content
      await waitFor(() => {
        expect(uploadArea).toHaveStyle({
          transform: 'scale(1.02)'
        });
        expect(screen.getByText('Drop images here')).toBeInTheDocument();
      });

      // Test drag leave state
      await act(async () => {
        fireEvent.dragLeave(uploadArea);
      });

      // Check return to default styles and content
      await waitFor(() => {
        expect(uploadArea).toHaveStyle({
          transform: 'scale(1)'
        });
        expect(screen.getByText('Drag and drop images here')).toBeInTheDocument();
      });
    });

    it('shows correct loading indicator and progress during upload', async () => {
    render(<ImageUpload {...defaultProps} />);
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    s3Service.uploadImage.mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => resolve('https://example.com/test.jpg'), 100);
      });
    });

    const input = screen.getByLabelText('Choose image files to upload');
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Check loading indicators
    const progressBar = await screen.findByLabelText('Upload progress');
    expect(progressBar).toBeInTheDocument();
    expect(screen.getByText('Uploading your images...')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload progress')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockOnUploadSuccess).toHaveBeenCalledWith(['https://example.com/test.jpg']);
    });
  });

    it('shows and styles backdrop overlay during file upload', async () => {
      render(<ImageUpload {...defaultProps} />);
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      let resolveUpload;
      s3Service.uploadImage.mockImplementation(() => new Promise(resolve => {
        resolveUpload = resolve;
      }));

      const input = screen.getByLabelText('Choose image files to upload');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Check backdrop overlay
      const backdrop = screen.getByRole('presentation');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveStyle('background-color: rgba(255, 255, 255, 0.8)');
      expect(backdrop).toHaveStyle('backdrop-filter: blur(4px)');
      expect(backdrop).toHaveStyle('position: absolute');
      expect(backdrop).toHaveStyle('z-index: 1');

      // Complete upload
      await act(async () => {
        resolveUpload('https://example.com/test.jpg');
      });

      await waitFor(() => {
        expect(backdrop).not.toBeVisible();
      });
    });

    it('shows and dismisses error alerts with correct styling', async () => {
      render(<ImageUpload {...defaultProps} />);
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      s3Service.uploadImage.mockRejectedValueOnce(new Error('Upload failed'));

      const input = screen.getByLabelText('Choose image files to upload');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Check error alert styling
      const alert = await screen.findByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveStyle('position: absolute');
      expect(alert).toHaveStyle('top: 16px');
      expect(alert).toHaveStyle('z-index: 3');
      expect(alert).toHaveStyle('box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15)');
      expect(alert).toHaveStyle('border: 1px solid #d32f2f');

      // Test error dismissal
      const closeButton = screen.getByRole('button', { name: /close/i });
      await act(async () => {
        fireEvent.click(closeButton);
      });

      await waitFor(() => {
        expect(alert).not.toBeInTheDocument();
      });
    });

    it('updates progress indicator with correct animations', async () => {
      render(<ImageUpload {...defaultProps} />);
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
      ];

      let resolveFirst, resolveSecond;
      s3Service.uploadImage
        .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
        .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));

      const input = screen.getByLabelText('Choose image files to upload');
      await act(async () => {
        fireEvent.change(input, { target: { files } });
      });

      // Check initial progress state
      const progressBar = screen.getByLabelText('Upload progress');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');

      // Complete first file upload
      await act(async () => {
        resolveFirst('https://example.com/test1.jpg');
      });

      // Check progress after first file
      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      });

      // Complete second file upload
      await act(async () => {
        resolveSecond('https://example.com/test2.jpg');
      });

      // Check progress completion
      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '100');
      });
    });

    it('provides accessible loading indicators with ARIA labels', async () => {
      render(<ImageUpload {...defaultProps} />);
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      let resolveUpload;
      s3Service.uploadImage.mockImplementation(() => new Promise(resolve => {
        resolveUpload = resolve;
      }));

      const input = screen.getByLabelText('Choose image files to upload');
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Check accessibility of loading indicators
      expect(screen.getByLabelText('Upload in progress')).toBeInTheDocument();
      expect(screen.getByLabelText('Upload progress')).toBeInTheDocument();
      
      const statusMessage = screen.getByRole('status');
      expect(statusMessage).toHaveAttribute('aria-live', 'polite');
      expect(statusMessage).toHaveTextContent('Uploading your images');

      // Complete upload
      await act(async () => {
        resolveUpload('https://example.com/test.jpg');
      });

      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('handles keyboard navigation correctly', async () => {
      render(<ImageUpload {...defaultProps} />);
      const uploadArea = screen.getByRole('region');
      const input = screen.getByLabelText('Choose image files to upload');

      // Test Enter key
      await act(async () => {
        fireEvent.keyDown(uploadArea, { key: 'Enter' });
      });
      expect(document.getElementById('file-input')).toBe(document.activeElement);

      // Test Space key
      await act(async () => {
        fireEvent.keyDown(uploadArea, { key: ' ' });
      });
      expect(document.getElementById('file-input')).toBe(document.activeElement);

      // Test Space key with 'Space' value
      await act(async () => {
        fireEvent.keyDown(uploadArea, { key: 'Space' });
      });
      expect(document.getElementById('file-input')).toBe(document.activeElement);

      // Test Escape key
      await act(async () => {
        fireEvent.keyDown(uploadArea, { key: 'Escape' });
      });
      expect(document.activeElement).not.toBe(uploadArea);

      // Test Tab key navigation
      await act(async () => {
        render(<ImageUpload {...defaultProps} />);
        const uploadArea = screen.getByRole('region');
        // Trigger an error to show the alert
        const file = new File(['test'], 'test.txt', { type: 'text/plain' });
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Wait for error alert to appear
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Test Tab navigation to close button
      await act(async () => {
        fireEvent.keyDown(uploadArea, { key: 'Tab' });
      });
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBe(document.activeElement);

      // Test Shift+Tab navigation
      await act(async () => {
        fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
      });
      expect(uploadArea).toBe(document.activeElement);

      // Test focus styles
      await act(async () => {
        fireEvent.focus(uploadArea);
      });
      expect(uploadArea).toHaveClass('MuiBox-root');
      expect(uploadArea).toHaveAttribute('style', expect.stringContaining('outline: 3px solid'));
      expect(uploadArea).toHaveAttribute('style', expect.stringContaining('outline-color: rgb(144, 202, 249)'));
    });

    it('clears error message on focus', async () => {
      render(<ImageUpload {...defaultProps} />);
      const uploadArea = screen.getByRole('region');
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const input = screen.getByLabelText('Choose image files to upload');

      // Trigger an error
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Verify error is shown
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Focus should clear error
      await act(async () => {
        fireEvent.focus(uploadArea);
      });

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  // Responsive design tests
  describe('Responsive design behavior', () => {
    beforeEach(() => {
      // Reset matchMedia mock before each test
      window.matchMedia = jest.fn();
    });

    const viewportSizes = {
      mobile: '(max-width: 600px)',
      tablet: '(min-width: 600px) and (max-width: 959px)',
      desktop: '(min-width: 960px)'
    };

    const setViewportSize = (size) => {
      window.matchMedia.mockImplementation(query => ({
        matches: query === viewportSizes[size],
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));
    };

    it('applies correct responsive styles for mobile viewport', () => {
      setViewportSize('mobile');
      render(<ImageUpload {...defaultProps} />);
      
      const uploadArea = screen.getByRole('region');
      const icon = screen.getByTestId('CloudUploadIcon');
      const heading = screen.getByText('Drag and drop images here');

      // Test responsive layout
      expect(uploadArea).toHaveClass('MuiBox-root');
      expect(uploadArea).toHaveStyle({
        padding: '16px',
        minHeight: '200px',
        maxWidth: '100%'
      });

      // Test responsive icon size
      expect(icon).toHaveStyle({
        fontSize: '48px',
        marginBottom: '8px'
      });

      // Test responsive typography
      expect(heading).toHaveStyle({
        fontSize: '1.1rem',
        textAlign: 'center'
      });

      // Test responsive alert positioning
      const alert = screen.getByRole('alert');
      expect(alert).toHaveStyle({
        position: 'absolute',
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '95%',
        zIndex: '1000'
      });

      // Test multiple alerts stacking
      const file1 = new File(['test1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['test2'], 'test2.exe', { type: 'application/x-msdownload' });
      
      const input = screen.getByLabelText('Choose image files to upload');
      fireEvent.change(input, { target: { files: [file1, file2] } });

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2);
      alerts.forEach((alert, index) => {
        expect(alert).toHaveStyle({
          top: `${8 + index * 64}px`
        });
      });
    });

    it('handles orientation and resize changes correctly', () => {
      const orientationQueries = {
        portrait: '(orientation: portrait)',
        landscape: '(orientation: landscape)'
      };

      // Test portrait mode
      window.matchMedia.mockImplementation(query => ({
        matches: query === orientationQueries.portrait,
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      const { rerender } = render(<ImageUpload {...defaultProps} />);
      const uploadArea = screen.getByRole('region');
      
      expect(uploadArea).toHaveStyle({
        minHeight: '200px',
        maxWidth: '100%',
        aspectRatio: '4/3'
      });

      // Test landscape mode
      window.matchMedia.mockImplementation(query => ({
        matches: query === orientationQueries.landscape,
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      rerender(<ImageUpload {...defaultProps} />);
      expect(uploadArea).toHaveStyle({
        minHeight: '250px',
        maxWidth: '100%',
        aspectRatio: '16/9'
      });

      // Test resize observer callback
      const resizeObserverCallback = window.ResizeObserver.mock.calls[0][0];
      const mockEntry = {
        contentRect: { width: 800, height: 600 }
      };

      act(() => {
        resizeObserverCallback([mockEntry]);
      });

      expect(uploadArea).toHaveStyle({
        padding: mockEntry.contentRect.width > 600 ? '24px' : '16px'
      });
    });

    it('applies correct responsive styles for tablet viewport with error handling', () => {
      setViewportSize('tablet');
      render(<ImageUpload {...defaultProps} />);
      
      const uploadArea = screen.getByRole('region');
      const icon = screen.getByTestId('CloudUploadIcon');
      const heading = screen.getByText('Drag and drop images here');

      expect(uploadArea).toHaveStyle({
        padding: '24px',
        minHeight: '250px',
        maxWidth: '90%',
        margin: '0 auto'
      });

      expect(icon).toHaveStyle({
        fontSize: '64px',
        marginBottom: '16px'
      });

      expect(heading).toHaveStyle({
        fontSize: '1.25rem',
        letterSpacing: '0.5px'
      });

      // Test error message handling for tablet
      const invalidFiles = [
        new File(['test1'], 'test1.txt', { type: 'text/plain' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
        new File(['test3'], 'test3.exe', { type: 'application/x-msdownload' })
      ];

      const input = screen.getByLabelText('Choose image files to upload');
      fireEvent.change(input, { target: { files: invalidFiles } });

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2); // Two invalid files
      
      alerts.forEach((alert, index) => {
        expect(alert).toHaveStyle({
          position: 'absolute',
          top: `${16 + index * 72}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '80%',
          padding: '12px 24px',
          borderRadius: '8px'
        });
      });
    });

    it('applies correct responsive styles for desktop viewport with error handling', () => {
      setViewportSize('desktop');
      render(<ImageUpload {...defaultProps} />);
      
      const uploadArea = screen.getByRole('region');
      const icon = screen.getByTestId('CloudUploadIcon');
      const heading = screen.getByText('Drag and drop images here');

      expect(uploadArea).toHaveStyle({
        padding: '32px',
        minHeight: '300px',
        maxWidth: '80%',
        margin: '0 auto',
        borderRadius: '12px'
      });

      expect(icon).toHaveStyle({
        fontSize: '72px',
        marginBottom: '24px'
      });

      expect(heading).toHaveStyle({
        fontSize: '1.5rem',
        letterSpacing: '0.75px'
      });

      // Test error message handling for desktop
      const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
      const invalidTypeFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });

      const input = screen.getByLabelText('Choose image files to upload');
      fireEvent.change(input, { target: { files: [largeFile, invalidTypeFile] } });

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2);

      alerts.forEach((alert, index) => {
        expect(alert).toHaveStyle({
          position: 'absolute',
          top: `${24 + index * 80}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '70%',
          padding: '16px 32px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        });

        // Test error message animations
        expect(alert).toHaveStyle({
          animation: expect.stringContaining('fadeIn'),
          transition: 'all 0.3s ease-in-out'
        });
      });
    });

    it('handles multiple concurrent error messages with proper stacking', () => {
      setViewportSize('desktop');
      render(<ImageUpload {...defaultProps} />);

      const files = [
        new File(['test1'], 'doc1.pdf', { type: 'application/pdf' }),
        new File(['test2'], 'doc2.txt', { type: 'text/plain' }),
        new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      ];

      const input = screen.getByLabelText('Choose image files to upload');
      fireEvent.change(input, { target: { files: files } });

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(3);

      // Test proper stacking and z-index
      alerts.forEach((alert, index) => {
        expect(alert).toHaveStyle({
          zIndex: 1000 + index,
          top: `${24 + index * 80}px`
        });

        // Verify each alert has unique error message
        expect(alert.textContent).toMatch(new RegExp(files[index].name));
      });

      // Test alert dismissal and animation
      const firstCloseButton = within(alerts[0]).getByRole('button', { name: /close/i });
      fireEvent.click(firstCloseButton);

      // Verify remaining alerts reposition
      waitFor(() => {
        const remainingAlerts = screen.getAllByRole('alert');
        expect(remainingAlerts).toHaveLength(2);
        remainingAlerts.forEach((alert, index) => {
          expect(alert).toHaveStyle({
            top: `${24 + index * 80}px`,
            transition: 'top 0.3s ease-in-out'
          });
        });
      });
    });
  });

  // Disabled state tests
  it('shows correct styles and behavior in disabled state', () => {
    render(<ImageUpload {...defaultProps} disabled={true} />);
    const uploadArea = screen.getByRole('region');

    expect(uploadArea).toHaveStyle({
      cursor: 'not-allowed',
      opacity: '0.7'
    });

    // Hover should not change styles in disabled state
    fireEvent.mouseEnter(uploadArea);
    expect(uploadArea).toHaveStyle({
      borderColor: 'rgb(224, 224, 224)',
      backgroundColor: 'rgb(245, 245, 245)'
    });

    // Drag events should not work in disabled state
    fireEvent.dragEnter(uploadArea);
    expect(screen.queryByText('Drop images here')).not.toBeInTheDocument();
  });
});

import { useState } from 'react';
import { ApiRequestError, apiErrorFromUploadResponse, getErrorMessage } from '@/lib/apiErrors';

interface UploadProgress {
  uploading: boolean;
  progress: number;
  error: string | null;
}

interface UploadResult {
  url: string;
  key: string;
}

export const useFileUpload = () => {
  const [state, setState] = useState<UploadProgress>({
    uploading: false,
    progress: 0,
    error: null
  });

  const uploadFile = async (
    file: File,
    type: 'image' | 'video' | 'certification' | 'attachment',
    additionalData?: { projectId?: string; certificationType?: string; questionId?: string }
  ): Promise<UploadResult> => {
    setState({ uploading: true, progress: 0, error: null });

    try {
      const formData = new FormData();
      formData.append(type, file);

      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          if (value) formData.append(key, value);
        });
      }

      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded * 100) / e.total);
          setState(prev => ({ ...prev, progress }));
        }
      });

      // Response handling
      interface UploadEnvelope { success?: boolean; message?: string; msg?: string; data?: UploadResult }
      const response = await new Promise<UploadEnvelope>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.response));
            } catch {
              reject(new ApiRequestError('The server returned an unexpected response.', {
                kind: 'invalidResponse',
                status: xhr.status,
              }));
            }
          } else {
            reject(apiErrorFromUploadResponse(xhr.status, xhr.responseText));
          }
        };
        xhr.onerror = () => reject(new ApiRequestError('You appear to be offline. Check your connection and try again.', { kind: 'network' }));

        xhr.open('POST', `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/projects/upload/${type}`);
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      if (response.success && response.data) {
        setState({ uploading: false, progress: 100, error: null });
        return response.data;
      }
      throw response.success
        ? new ApiRequestError('The server returned an unexpected response.', { kind: 'invalidResponse' })
        : response;
    } catch (error: unknown) {
      setState({
        uploading: false,
        progress: 0,
        error: getErrorMessage(error, 'The upload failed. Please try again.'),
      });
      throw error;
    }
  };

  const reset = () => {
    setState({ uploading: false, progress: 0, error: null });
  };

  return { ...state, uploadFile, reset };
};

'use client';

import { useMutation } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.replace(/^data:[^;]+;base64,/, ''));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useUploadHelpImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const data = await fileToBase64(file);
      return bffApi<{ storageKey: string }>('/api/help/images', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, contentType: file.type, data }),
      });
    },
  });
}

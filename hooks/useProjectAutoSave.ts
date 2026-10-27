import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/apiErrors';

interface ProjectData {
  _id?: string;
  [key: string]: unknown;
}

export const useProjectAutoSave = (projectData: ProjectData, interval: number = 30000) => {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveProject = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(projectData)
      });

      const result = await response.json();

      if (result.success) {
        setLastSaved(new Date());
        return result.data;
      }
      throw result;
    } catch (error: unknown) {
      console.error('Auto-save failed:', error);
      toast.error(getErrorMessage(error, 'Failed to save draft'));
    } finally {
      setSaving(false);
    }
  };

  // Auto-save on interval
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      saveProject();
    }, interval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [projectData, interval]);

  return { saveProject, lastSaved, saving };
};

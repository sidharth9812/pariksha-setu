import React, { createContext, useContext, useEffect, useState } from 'react';
import { InstituteSettings } from '../types/exam';
import {
  getInstituteSettings,
  saveInstituteSettings,
  seedInitialDataIfEmpty,
  resetToDemoData,
} from '../services/examService';
import { DEFAULT_INSTITUTE_SETTINGS } from '../data/mockExamData';

interface InstituteContextType {
  settings: InstituteSettings;
  updateSettings: (newSettings: InstituteSettings) => Promise<void>;
  resetDemoData: () => Promise<void>;
  loading: boolean;
}

const InstituteContext = createContext<InstituteContextType | undefined>(undefined);

export const InstituteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<InstituteSettings>(DEFAULT_INSTITUTE_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      try {
        await seedInitialDataIfEmpty();
        const s = await getInstituteSettings();
        setSettings(s);
      } catch (err) {
        console.warn('Institute settings load error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleUpdate = async (newSettings: InstituteSettings) => {
    setSettings(newSettings);
    await saveInstituteSettings(newSettings);
  };

  const handleReset = async () => {
    setLoading(true);
    await resetToDemoData();
    const s = await getInstituteSettings();
    setSettings(s);
    setLoading(false);
  };

  return (
    <InstituteContext.Provider
      value={{
        settings,
        updateSettings: handleUpdate,
        resetDemoData: handleReset,
        loading,
      }}
    >
      {children}
    </InstituteContext.Provider>
  );
};

export function useInstitute() {
  const ctx = useContext(InstituteContext);
  if (!ctx) {
    throw new Error('useInstitute must be used within an InstituteProvider');
  }
  return ctx;
}

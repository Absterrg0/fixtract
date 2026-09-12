'use client';

import React, { useEffect } from 'react';
import { registerAppServiceWorker } from '@/lib/pwa/serviceWorker';

const ServiceWorkerRegistrar: React.FC = () => {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    void registerAppServiceWorker();
  }, []);

  return null;
};

export default ServiceWorkerRegistrar;

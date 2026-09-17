import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsService } from '../services/settingsService';
import { categoryService } from '../services/categoryService';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState({
    storeName: 'LN SPORTS',
    whatsappNumber: '5549998046866',
    whatsappEnabled: true,
    defaultMessage: 'Olá! Gostaria de falar com um atendente da LN SPORTS.',
    productMessageTemplate: 'Olá! Tenho interesse neste produto:\nProduto: {productName}\nLink: {productUrl}\nGostaria de saber mais informações.'
  });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [fetchedSettings, fetchedCategories] = await Promise.all([
        settingsService.getSettings(),
        categoryService.getCategories()
      ]);
      if (fetchedSettings) setSettings(fetchedSettings);
      if (fetchedCategories) setCategories(fetchedCategories);
    } catch (e) {
      console.error("[StoreContext] Erro ao carregar dados da loja:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const updateSettings = async (newSettings) => {
    const saved = await settingsService.saveSettings(newSettings);
    setSettings(saved);
    return saved;
  };

  return (
    <StoreContext.Provider value={{
      settings,
      categories,
      loading,
      refreshSettings: loadData,
      updateSettings
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore deve ser utilizado dentro de um StoreProvider');
  }
  return context;
}

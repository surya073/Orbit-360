import { createContext, useContext } from 'react';
import { DEFAULT_ICON_STYLE } from '../../config/icons';

// Lives outside ThemeProvider's file so Icon can read it without importing the provider (and so
// components render with the default style when used without a provider, e.g. in isolation).
export const IconStyleContext = createContext(DEFAULT_ICON_STYLE);
export const useIconStyle = () => useContext(IconStyleContext);

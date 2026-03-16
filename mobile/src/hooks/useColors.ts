import { useThemeStore } from '../store';
import { Colors, DarkColors } from '../constants/colors';

export function useColors() {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? DarkColors : Colors;
}

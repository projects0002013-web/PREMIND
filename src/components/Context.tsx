import { createContext, useContext } from "react";
import type { Data } from "../types";
export interface ContextValue {
  data: Data;
  update: (fn: (d: Data) => Data) => Promise<void>;
  lang: "ru" | "en";
  t: (ru: string, en: string) => string;
}
export const AppContext = createContext<ContextValue>(null!);
export const useApp = () => useContext(AppContext);
export const names = {
  reaction: ["Реакция", "Reaction time"],
  stroop: ["Тест Струпа", "Stroop test"],
  attention: ["Устойчивость внимания", "Sustained attention"],
  memory: ["Рабочая память", "Working memory"],
  search: ["Визуальный поиск", "Visual search"],
};

import type { AppAction, AppState } from "@/app/state/types";

export function uiReducer(state: AppState, action: AppAction): AppState | undefined {
  switch (action.type) {
    case "set_role":
      return {
        ...state,
        role: action.role,
        gmView: action.role === "gm" ? state.gmView : "console"
      };
    case "set_gm_password":
      return { ...state, gmPassword: action.password };
    case "set_gm_authenticated":
      return { ...state, gmAuthenticated: action.value };
    case "set_gm_view":
      return { ...state, gmView: action.view };
    case "set_template_search":
      return { ...state, templateSearch: action.value };
    default:
      return undefined;
  }
}

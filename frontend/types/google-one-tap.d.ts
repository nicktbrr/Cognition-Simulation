declare module 'google-one-tap' {
  export interface accounts {
    id: {
      initialize: (config: any) => void;
      renderButton: (element: HTMLElement, options: any) => void;
      disableAutoSelect: () => void;
      revoke: (id: string, callback: () => void) => void;
      prompt: () => void;
    };
  }

  export interface CredentialResponse {
    credential: string;
    select_by: string;
  }
} 
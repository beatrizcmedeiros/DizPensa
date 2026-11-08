import type { AuthError } from '@supabase/supabase-js';

/** Traduz as mensagens de erro mais comuns do Supabase Auth. */
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'email_not_confirmed':
      return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Já existe uma conta com esse e-mail.';
    case 'weak_password':
      return 'Senha fraca. Use pelo menos 8 caracteres.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Muitas tentativas. Espere um pouco e tente de novo.';
  }
  if (error.name === 'AuthRetryableFetchError') {
    return 'Sem conexão com a internet.';
  }
  return error.message;
}

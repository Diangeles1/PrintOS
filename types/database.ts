// Este arquivo será substituído pelos tipos gerados do Supabase.
// Depois de conectar o projeto, podemos gerar os tipos automaticamente.
//
// Exemplo:
//
// npx supabase gen types typescript --project-id SEU_PROJECT_ID > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
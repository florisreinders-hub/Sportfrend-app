import { supabase } from "./supabase";

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
}

export async function signOut() {
  return supabase.auth.signOut();
}

"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type FormState = {
  error?: string;
  success?: string;
};

const credentialsSchema = z.object({
  email: z.string().email("Ugyldig e-postadresse."),
  password: z.string().min(8, "Passord må være minst 8 tegn.")
});

const resetSchema = z.object({
  email: z.string().email("Ugyldig e-postadresse.")
});

const updatePasswordSchema = z.object({
  password: z.string().min(8, "Passord må være minst 8 tegn.")
});

export async function signInAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Innlogging feilet. Sjekk e-post og passord." };
  }

  redirect("/dashboard");
}

export async function signUpAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const supabase = await createServerSupabaseClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`
    }
  });

  if (error) {
    return { error: "Registrering feilet. Prøv igjen." };
  }

  return {
    success: "Konto opprettet. Sjekk e-post for verifisering hvis det er aktivert."
  };
}

export async function resetPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({
    email: formData.get("email")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const supabase = await createServerSupabaseClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/update-password`
  });

  if (error) {
    return { error: "Kunne ikke sende e-post for passordreset." };
  }

  return { success: "Sjekk e-post for lenke til passordreset." };
}

export async function updatePasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: "Kunne ikke oppdatere passord." };
  }

  return { success: "Passord oppdatert. Du kan logge inn igjen." };
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

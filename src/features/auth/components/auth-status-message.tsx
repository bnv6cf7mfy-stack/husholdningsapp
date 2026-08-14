type AuthStatusMessageProps = {
  error?: string;
  success?: string;
};

export function AuthStatusMessage({ error, success }: AuthStatusMessageProps) {
  if (!error && !success) {
    return null;
  }

  return (
    <p
      className={`rounded-xl px-3 py-2 text-sm ${
        error ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      }`}
    >
      {error ?? success}
    </p>
  );
}

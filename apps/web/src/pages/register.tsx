import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ApiRequestError, api } from "@/lib/api";
import type { AuthResponse } from "@stratum/shared";
import { useAuthStore } from "@/store/auth";
import { AuthShell } from "./login";

export function RegisterPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFields({});
    try {
      const auth = await api<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: { name, email, password, jobTitle: jobTitle || undefined },
        auth: false,
      });
      setSession(auth);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
        setFields(err.fieldErrors);
      } else setError("Could not create the account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-1 text-sm text-muted">The first person on a fresh database becomes the administrator.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fields.email} required />
        <Input label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Optional" />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fields.password}
          hint="At least 8 characters, with a letter and a number"
          required
        />
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

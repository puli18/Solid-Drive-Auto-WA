/**
 * Form helpers for public forms: react-hook-form + the shared zod schemas (via zodResolver), friendlier
 * messages for empty number fields, server-issue mapping, and consistent field/submit/alert styling.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Control, FieldValues, Path, Resolver, UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { actionErrorMessage, actionFieldIssues } from '@/lib/data';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyForm<T extends FieldValues> = UseFormReturn<T, any, any>;

const FRIENDLY: [RegExp, string][] = [
  [/expected number, received (nan|undefined)/i, 'Enter a number'],
  [/expected string, received undefined/i, 'Required'],
  [/too small: expected number to be >=?\s*1950/i, 'Enter a year from 1950'],
  [/too big: expected number to be <=?\s*\d{4}/i, 'Enter a valid year'],
  [/invalid (iso )?datetime/i, 'Choose a time'],
];

function friendly(msg?: string) {
  if (!msg) return msg;
  for (const [re, nice] of FRIENDLY) if (re.test(msg)) return nice;
  return msg;
}

function rewrite(errors: Record<string, unknown>): void {
  for (const v of Object.values(errors)) {
    if (!v || typeof v !== 'object') continue;
    const e = v as { message?: string; type?: unknown };
    if (typeof e.message === 'string' && 'type' in e) e.message = friendly(e.message);
    else rewrite(v as Record<string, unknown>);
  }
}

/** zodResolver over a shared schema, with friendlier messages for empty/NaN number inputs. */
export function sharedResolver<S extends z.ZodType<FieldValues, FieldValues>>(schema: S) {
  const base = zodResolver(schema as never) as unknown as Resolver<z.input<S>, unknown, z.output<S>>;
  const wrapped: Resolver<z.input<S>, unknown, z.output<S>> = async (values, ctx, opts) => {
    const res = await base(values, ctx, opts);
    if (res.errors) rewrite(res.errors as Record<string, unknown>);
    return res;
  };
  return wrapped;
}

/** Map a failed action onto the form: field issues → field errors; returns the banner message. */
export function applyActionError<T extends FieldValues>(form: AnyForm<T>, err: unknown): string {
  const issues = actionFieldIssues(err);
  let first = true;
  for (const i of issues) {
    if (!i.path) continue;
    form.setError(i.path as Path<T>, { type: 'server', message: i.message }, { shouldFocus: first });
    first = false;
  }
  return actionErrorMessage(err);
}

export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  hint,
  multiline,
  className,
  asNumber,
  required,
}: {
  form: AnyForm<T>;
  name: Path<T>;
  label: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  className?: string;
  asNumber?: boolean;
  required?: boolean;
}) {
  return (
    <FormField
      control={form.control as unknown as Control<T>}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {required ? (
              <span aria-hidden className="text-brand-red">
                *
              </span>
            ) : null}
          </FormLabel>
          <FormControl>
            {multiline ? (
              <Textarea {...field} value={field.value ?? ''} placeholder={placeholder} rows={4} className="min-h-28 text-base sm:text-sm" />
            ) : (
              <Input
                {...field}
                type={type}
                autoComplete={autoComplete}
                inputMode={inputMode}
                placeholder={placeholder}
                value={field.value ?? ''}
                onChange={(e) => {
                  if (!asNumber) return field.onChange(e);
                  const raw = e.target.value.replace(/[^\d]/g, '');
                  field.onChange(raw === '' ? undefined : Number(raw));
                }}
                className="h-12 text-base sm:text-sm"
              />
            )}
          </FormControl>
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function FormAlert({ message, className }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn('border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2.5 rounded-lg border p-3 text-sm', className)}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel = 'Sending…',
  className,
  disabled,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
      className={cn(
        'sda-press bg-brand-red hover:bg-brand-red-hover inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto',
        className,
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function DemoNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-muted-foreground flex items-center gap-2 text-xs', className)}>
      <span aria-hidden className="bg-brand-red inline-block size-1.5 rounded-full" />
      {children}
    </p>
  );
}

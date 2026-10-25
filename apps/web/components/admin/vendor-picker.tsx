/** Vendor combobox with inline create ("Add “Name” as a vendor"). */
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/lib/auth';
import { actionErrorMessage, getAdminRepo, type VendorRecord } from '@/lib/data';
import { cn } from '@/lib/utils';

export function VendorPicker({
  vendors,
  value,
  onChange,
  onCreated,
  id,
}: {
  vendors: VendorRecord[];
  value: { id: string | null; name: string };
  onChange: (v: { id: string | null; name: string }) => void;
  onCreated?: () => void;
  id?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const exact = vendors.some((v) => v.name.toLowerCase() === query.trim().toLowerCase());

  async function create() {
    const name = query.trim();
    if (!name || !user) return;
    setCreating(true);
    try {
      const vid = await getAdminRepo().createVendor({ name }, user.uid);
      onChange({ id: vid, name });
      onCreated?.();
      toast.success(`Vendor “${name}” added`);
      setOpen(false);
      setQuery('');
    } catch (e) {
      toast.error(actionErrorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn('truncate', !value.name && 'text-muted-foreground')}>{value.name || 'Choose or add a vendor'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search vendors…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-xs">No vendor found.</CommandEmpty>
            <CommandGroup>
              {value.name && (
                <CommandItem value="__none__" onSelect={() => { onChange({ id: null, name: '' }); setOpen(false); }}>
                  <span className="text-muted-foreground">No vendor</span>
                </CommandItem>
              )}
              {vendors.map((v) => (
                <CommandItem key={v.id} value={v.name} onSelect={() => { onChange({ id: v.id, name: v.name }); setOpen(false); }}>
                  <Check className={cn('size-4', value.id === v.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{v.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {query.trim() && !exact && (
              <CommandGroup forceMount>
                <CommandItem value={`__create__${query}`} onSelect={() => void create()} forceMount>
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  Add “{query.trim()}” as a vendor
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

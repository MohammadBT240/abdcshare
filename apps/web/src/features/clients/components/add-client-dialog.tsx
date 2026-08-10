'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FormDialog,
  FormField,
  FormSection,
  LoadingButton,
  LookupSelect,
  ProfilePhotoUpload,
  DatePicker,
} from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import { useCreateClient } from '@/features/clients/hooks/use-clients';
import { clientTypeKind } from '@/features/clients/constants';
import { useLookup } from '@/features/users/hooks/use-users';
import { uploadUserAvatar } from '@/features/users/lib/upload-user-avatar';
import { parse, isValid, format } from 'date-fns';

interface AddClientFormValues {
  clientTypeId: string;
  firstName: string;
  surname: string;
  companyName: string;
  companyRegisteredAddress: string;
  incorporationDate: string;
  incorporationNo: string;
  officialAddress: string;
  residentialAddress: string;
  email: string;
  phoneNumber: string;
  contactFirstName: string;
  contactSurname: string;
  contactEmail: string;
  contactPhone: string;
}

const emptyValues: AddClientFormValues = {
  clientTypeId: '',
  firstName: '',
  surname: '',
  companyName: '',
  companyRegisteredAddress: '',
  incorporationDate: '',
  incorporationNo: '',
  officialAddress: '',
  residentialAddress: '',
  email: '',
  phoneNumber: '',
  contactFirstName: '',
  contactSurname: '',
  contactEmail: '',
  contactPhone: '',
};

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (clientId: string) => void;
}

export function AddClientDialog({ open, onOpenChange, onCreated }: AddClientDialogProps) {
  const qc = useQueryClient();
  const create = useCreateClient();
  const clientTypes = useLookup('client-types');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const form = useForm<AddClientFormValues>({ defaultValues: emptyValues });

  useEffect(() => {
    if (!open) {
      form.reset(emptyValues);
      setAvatarFile(null);
    }
  }, [open, form]);

  const selectedTypeId = form.watch('clientTypeId');
  const selectedTypeName = clientTypes.data?.find((t) => String(t.id) === selectedTypeId)?.name;
  const kind = clientTypeKind(selectedTypeName);
  const isIndividual = kind === 'individual';
  const isCorporate = kind === 'corporate';

  const firstName = form.watch('firstName');
  const surname = form.watch('surname');
  const contactFirstName = form.watch('contactFirstName');
  const contactSurname = form.watch('contactSurname');

  const avatarInitials = useMemo(() => {
    if (isIndividual) {
      return `${firstName?.trim()?.[0] ?? ''}${surname?.trim()?.[0] ?? ''}` || '?';
    }
    if (isCorporate) {
      return `${contactFirstName?.trim()?.[0] ?? ''}${contactSurname?.trim()?.[0] ?? ''}` || '?';
    }
    return '?';
  }, [firstName, surname, contactFirstName, contactSurname, isIndividual, isCorporate]);

  async function onSubmit(values: AddClientFormValues) {
    if (!values.clientTypeId) {
      toast.error('Select a client type');
      return;
    }
    if (isCorporate && !values.companyName.trim()) {
      toast.error('Company name is required for corporate clients');
      return;
    }
    if (isIndividual && !values.email.trim()) {
      toast.error('Email is required — it is used for portal login');
      return;
    }

    try {
      let contact: Record<string, unknown>;
      let clientName: string;

      if (isIndividual) {
        const first = values.firstName.trim();
        const last = values.surname.trim();
        clientName = [first, last].filter(Boolean).join(' ');
        contact = {
          firstName: first,
          surname: last,
          email: values.email.trim(),
        };
        if (values.phoneNumber.trim()) contact.phoneNumber = values.phoneNumber.trim();
      } else {
        clientName = values.companyName.trim();
        contact = {
          firstName: values.contactFirstName.trim(),
          surname: values.contactSurname.trim(),
          email: values.contactEmail.trim(),
        };
        if (values.contactPhone.trim()) contact.phoneNumber = values.contactPhone.trim();
      }

      const body: Record<string, unknown> = {
        name: clientName,
        clientTypeId: Number(values.clientTypeId),
        contact,
      };

      if (isIndividual) {
        body.email = values.email.trim();
        if (values.phoneNumber.trim()) body.phoneNumber = values.phoneNumber.trim();
        if (values.residentialAddress.trim()) body.residentialAddress = values.residentialAddress.trim();
        if (values.officialAddress.trim()) body.officialAddress = values.officialAddress.trim();
      }

      if (isCorporate) {
        if (values.email.trim()) body.email = values.email.trim();
        if (values.phoneNumber.trim()) body.phoneNumber = values.phoneNumber.trim();
        // Same value for list display (`name`) and legal registered name (`companyName`).
        body.companyName = clientName;
        if (values.companyRegisteredAddress.trim()) {
          body.companyRegisteredAddress = values.companyRegisteredAddress.trim();
        }
        if (values.incorporationNo.trim()) body.incorporationNo = values.incorporationNo.trim();
        if (values.incorporationDate) body.incorporationDate = values.incorporationDate;
        if (values.officialAddress.trim()) body.officialAddress = values.officialAddress.trim();
      }

      const client = await create.mutateAsync(body);
      const warnings: string[] = [];

      if (avatarFile && client.primaryContactId) {
        try {
          await uploadUserAvatar(client.primaryContactId, avatarFile);
          await qc.invalidateQueries({ queryKey: ['clients'] });
        } catch (err) {
          warnings.push(err instanceof Error ? err.message : 'Photo upload failed');
        }
      }

      if (warnings.length > 0) {
        toast.warning(`Client created — ${warnings.join('; ')}`);
      } else {
        toast.success('Client created — login credentials emailed');
      }
      onOpenChange(false);
      onCreated?.(client.id);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not create client');
    }
  }

  const lookupsReady = !clientTypes.isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add client"
      description="Create a client record and portal login. Fields adjust for Individual vs Corporate."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="add-client-form"
            loading={create.isPending}
            disabled={!kind || !lookupsReady}
          >
            Create client
          </LoadingButton>
        </>
      }
    >
      <form id="add-client-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="mb-0">
              <FormField
                label="Client type"
                required
                description="Individual for a person; Corporate for a registered company."
              >
                <LookupSelect
                  type="client-types"
                  value={form.watch('clientTypeId') || undefined}
                  onValueChange={(v) => form.setValue('clientTypeId', v)}
                  placeholder="Select type"
                  className="max-w-sm"
                />
              </FormField>
            </div>

            {kind ? (
              <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
                <div className="space-y-5">
                  <FormSection title="Profile">
                    <ProfilePhotoUpload
                      value={avatarFile}
                      onChange={setAvatarFile}
                      initials={avatarInitials}
                      description={
                        isIndividual
                          ? 'Optional — applied to the individual’s portal login.'
                          : 'Optional — applied to the primary contact’s portal login.'
                      }
                    />
                  </FormSection>

                  {isIndividual ? (
                    <FormSection
                      title="Identity"
                      description="The individual is also the portal login — no separate contact is needed."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="First name" required>
                          <Input {...form.register('firstName', { required: true })} />
                        </FormField>
                        <FormField label="Surname" required>
                          <Input {...form.register('surname', { required: true })} />
                        </FormField>
                        <FormField
                          label="Email"
                          required
                          description="Portal login credentials are emailed here."
                          className="sm:col-span-2"
                        >
                          <Input type="email" {...form.register('email', { required: true })} />
                        </FormField>
                        <FormField label="Phone" className="sm:col-span-2">
                          <Input {...form.register('phoneNumber')} />
                        </FormField>
                      </div>
                    </FormSection>
                  ) : null}

                  {isCorporate ? (
                    <FormSection
                      title="Organisation"
                      description="Legal details for the company record."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField
                          label="Company name"
                          required
                          description="Legal registered name — also used in lists and reports."
                          className="sm:col-span-2"
                        >
                          <Input {...form.register('companyName', { required: true })} />
                        </FormField>
                        <FormField label="Incorporation no." description="CAC / registration number.">
                          <Input {...form.register('incorporationNo')} />
                        </FormField>
                        <FormField label="Incorporation date">
                          <DatePicker
                            value={(() => {
                              const raw = form.watch('incorporationDate');
                              if (!raw) return undefined;
                              const d = parse(raw, 'yyyy-MM-dd', new Date());
                              return isValid(d) ? d : undefined;
                            })()}
                            onChange={(d) =>
                              form.setValue('incorporationDate', d ? format(d, 'yyyy-MM-dd') : '')
                            }
                          />
                        </FormField>
                        <FormField label="Client email" description="General organisation email.">
                          <Input type="email" {...form.register('email')} />
                        </FormField>
                        <FormField label="Client phone">
                          <Input {...form.register('phoneNumber')} />
                        </FormField>
                      </div>
                    </FormSection>
                  ) : null}
                </div>

                <div className="space-y-5">
                  {isCorporate ? (
                    <FormSection
                      title="Primary contact"
                      description="Receives portal login credentials and represents the company."
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label="First name" required>
                          <Input {...form.register('contactFirstName', { required: true })} />
                        </FormField>
                        <FormField label="Surname" required>
                          <Input {...form.register('contactSurname', { required: true })} />
                        </FormField>
                        <FormField
                          label="Email"
                          required
                          description="A temporary password will be emailed here."
                          className="sm:col-span-2"
                        >
                          <Input
                            type="email"
                            {...form.register('contactEmail', { required: true })}
                          />
                        </FormField>
                        <FormField label="Phone" className="sm:col-span-2">
                          <Input {...form.register('contactPhone')} />
                        </FormField>
                      </div>
                    </FormSection>
                  ) : null}

                  <FormSection title="Addresses" description="Optional.">
                    <div className="grid gap-3">
                      {isCorporate ? (
                        <FormField
                          label="Registered address"
                          description="Address on the certificate of incorporation."
                        >
                          <Textarea rows={2} {...form.register('companyRegisteredAddress')} />
                        </FormField>
                      ) : null}
                      {isIndividual ? (
                        <FormField
                          label="Residential address"
                          description="Home address for the individual."
                        >
                          <Textarea rows={2} {...form.register('residentialAddress')} />
                        </FormField>
                      ) : null}
                      <FormField
                        label="Official address"
                        description={
                          isCorporate
                            ? 'Principal place of business.'
                            : 'Business or correspondence address, if different.'
                        }
                      >
                        <Textarea rows={2} {...form.register('officialAddress')} />
                      </FormField>
                    </div>
                  </FormSection>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a client type to continue with the form.
              </p>
            )}
      </form>
    </FormDialog>
  );
}

'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { sql } from '@vercel/postgres';
import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({invalid_type_error: 'cmon'}),
    amount: z.coerce.number().gt(0,'more than 0 papu'),
    status: z.enum(['pending', 'paid'],{invalid_type_error:'choose an state'}),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
  };

export async function createInvoice(prevState: State, formData: FormData) {
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
      });

    if (!validatedFields.success) {
        return {
          errors: validatedFields.error.flatten().fieldErrors,
          message: 'Missing Fields. Failed to Create Invoice.',
        };
      }
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];
    try {
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
          `;
    } catch (e) {
        return {
            message: 'Database Error: Failed to create Invoice.',
        };
      }
      goto();
      return {message:'created succesfully'};

}

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    const amountInCents = amount * 100;
    try {
        await sql`
        UPDATE invoices
        SET Customer_id = ${customerId}, Amount =  ${amountInCents}, Status  = ${status} where id = ${id}
        `;
        goto();
    } catch (e) {
        return {
            message: 'Database Error: Failed to update Invoice.',
        };

    }
}

export async function deleteInvoice(id: string) {
    try {
        await sql`
     DELETE FROM invoices where id = ${id}
    `;
       goto();
    } catch (e) {
        return {
            message: 'Database Error: Failed to delete Invoice.',
        };

    }

}

const goto = () => {
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
  ) {
    try {
      await signIn('credentials', formData);
    } catch (error) {
      if (error instanceof AuthError) {
        switch (error.type) {
          case 'CredentialsSignin':
            return 'Invalid credentials.';
          default:
            return 'Something went wrong.';
        }
      }
      throw error;
    }
  }
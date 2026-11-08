import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const variants = cva('button', { variants: { variant: { default: 'button-default', primary: 'button-primary', ghost: 'button-ghost', danger: 'button-danger' }, size: { default: '', icon: 'button-icon', small: 'button-small' } }, defaultVariants: { variant: 'default', size: 'default' } });
// shadcn/ui Button pattern, styled for the RoomShift desktop theme.
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<'button'> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={twMerge(clsx(variants({ variant, size }), className))} {...props} />;
}

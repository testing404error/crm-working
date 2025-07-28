import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendInvitation: (email: string, role: string) => void;
}

export function InvitationModal({
  isOpen,
  onClose,
  onSendInvitation,
}: InvitationModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');

  const handleSendInvitation = () => {
    if (!email || !role) {
      setError('Email and role are required.');
      return;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Invalid email format.');
      return;
    }
    setError('');
    onSendInvitation(email, role);
    // Reset form and close
    setEmail('');
    setRole('');
    onClose();
  };
  
  const handleClose = () => {
    // Reset state on close
    setEmail('');
    setRole('');
    setError('');
    onClose();
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="email" className="text-right">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <div className="col-span-3">
                <Select onValueChange={setRole} value={role}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
           {error && <p className="col-span-4 text-center text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSendInvitation}>Send Invitation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

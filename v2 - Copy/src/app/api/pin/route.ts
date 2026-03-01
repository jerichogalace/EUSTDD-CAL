import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { randomBytes, pbkdf2Sync } from 'crypto';

function hashPin(pin: string): string {
  const salt = 'pcieerd-calendar-salt';
  return pbkdf2Sync(pin, salt, 1000, 64, 'sha512').toString('hex');
}

// GET - Check if PIN is set
export async function GET() {
  try {
    const pinRecord = await db.adminPin.findFirst();
    return NextResponse.json({ hasPin: !!pinRecord });
  } catch (error) {
    console.error('Error checking PIN:', error);
    return NextResponse.json({ error: 'Failed to check PIN' }, { status: 500 });
  }
}

// POST - Set PIN or Verify PIN
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin, action } = body;

    if (action === 'verify') {
      const pinRecord = await db.adminPin.findFirst();
      if (!pinRecord) {
        return NextResponse.json({ valid: true }); // No PIN set
      }
      const hashedPin = hashPin(pin);
      const valid = pinRecord.pinHash === hashedPin;
      return NextResponse.json({ valid });
    }

    if (action === 'set') {
      if (!pin) {
        // Remove PIN
        await db.adminPin.deleteMany();
        return NextResponse.json({ success: true, message: 'PIN removed' });
      }

      const hashedPin = hashPin(pin);
      await db.adminPin.deleteMany();
      await db.adminPin.create({
        data: { pinHash: hashedPin },
      });
      return NextResponse.json({ success: true, message: 'PIN set' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error with PIN:', error);
    return NextResponse.json({ error: 'Failed to process PIN' }, { status: 500 });
  }
}

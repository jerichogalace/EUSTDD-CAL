import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch settings
export async function GET() {
  try {
    const settingsRecord = await db.adminSetting.findUnique({
      where: { key: 'display_settings' },
    });

    if (!settingsRecord) {
      return NextResponse.json({ settings: null });
    }

    return NextResponse.json({ settings: JSON.parse(settingsRecord.value) });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST - Save settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json({ error: 'Settings are required' }, { status: 400 });
    }

    // Upsert settings
    const settingsRecord = await db.adminSetting.upsert({
      where: { key: 'display_settings' },
      update: { value: JSON.stringify(settings) },
      create: { key: 'display_settings', value: JSON.stringify(settings) },
    });

    return NextResponse.json({ success: true, settings: JSON.parse(settingsRecord.value) });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

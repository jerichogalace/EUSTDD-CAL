import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { startOfDay, endOfDay, addDays } from 'date-fns';

// GET all events or filter by date
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const category = searchParams.get('category');
    const dateStr = searchParams.get('date');

    let where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (filter === 'today') {
      const today = new Date();
      where.date = {
        gte: startOfDay(today),
        lte: endOfDay(today),
      };
      where.category = 'schedule';
    } else if (filter === 'tomorrow') {
      const tomorrow = addDays(new Date(), 1);
      where.date = {
        gte: startOfDay(tomorrow),
        lte: endOfDay(tomorrow),
      };
      where.category = 'schedule';
    } else if (dateStr) {
      const targetDate = new Date(dateStr);
      where.date = {
        gte: startOfDay(targetDate),
        lte: endOfDay(targetDate),
      };
    }

    const events = await db.event.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

// POST create new event
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, date, endDate, time, timeEnd, location, description, status, category } = body;

    if (!title || !date || !time) {
      return NextResponse.json({ error: 'Title, date, and time are required' }, { status: 400 });
    }

    const event = await db.event.create({
      data: {
        title,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        time,
        timeEnd: timeEnd || null,
        location: location || null,
        description: description || null,
        status: status || 'upcoming',
        category: category || 'schedule',
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}

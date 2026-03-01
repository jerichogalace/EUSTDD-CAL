import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch all project requests
export async function GET() {
  try {
    const projectRequests = await db.projectRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(projectRequests);
  } catch (error) {
    console.error('Error fetching project requests:', error);
    return NextResponse.json({ error: 'Failed to fetch project requests' }, { status: 500 });
  }
}

// POST - Create a new project request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, number, status } = body;

    if (!name || !number) {
      return NextResponse.json({ error: 'Name and number are required' }, { status: 400 });
    }

    const projectRequest = await db.projectRequest.create({
      data: {
        name,
        number: String(number), // Convert to string for flexibility
        status: status || null, // Allow null status
      },
    });

    return NextResponse.json(projectRequest);
  } catch (error) {
    console.error('Error creating project request:', error);
    return NextResponse.json({ error: 'Failed to create project request' }, { status: 500 });
  }
}

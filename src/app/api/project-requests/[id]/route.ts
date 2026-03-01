import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch a single project request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectRequest = await db.projectRequest.findUnique({
      where: { id },
    });

    if (!projectRequest) {
      return NextResponse.json({ error: 'Project request not found' }, { status: 404 });
    }

    return NextResponse.json(projectRequest);
  } catch (error) {
    console.error('Error fetching project request:', error);
    return NextResponse.json({ error: 'Failed to fetch project request' }, { status: 500 });
  }
}

// PUT - Update a project request
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, number, status } = body;

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (number !== undefined) updateData.number = number;
    if (status !== undefined) updateData.status = status; // Allow null status

    const projectRequest = await db.projectRequest.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(projectRequest);
  } catch (error) {
    console.error('Error updating project request:', error);
    return NextResponse.json({ error: 'Failed to update project request' }, { status: 500 });
  }
}

// DELETE - Delete a project request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.projectRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project request:', error);
    return NextResponse.json({ error: 'Failed to delete project request' }, { status: 500 });
  }
}
